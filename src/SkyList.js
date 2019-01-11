import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
	listType: 'more',
};

// function objectToQueryString(params) {
// 	return qs.stringify(params, {
// 		skipNulls: true,
// 		arrayFormat: 'repeat',
// 		addQueryPrefix: true,
// 	});
// }

function getQueryParams() {
	if (typeof window !== 'undefined') {
		const q = window.location.search.replace('?', '');
		return qs.parse(q);
	}

	return {};
}

// function setQueryParams(params) {
// 	if (typeof window !== 'undefined') {
// 		const { protocol, host, pathname } = window.location;
// 		const newUrl = `${protocol}//${host}${pathname}${objectToQueryString(params)}`;

// 		window.history.replaceState('', '', `${newUrl}`);
// 	}
// }

export default {
	name: 'SkyList',
	props: {
		// Set up parameters to v-model
		parameters: {
			type: Object,
			default: () => ({}),
		},
		options: {
			type: Object,
			default: () => ({}),
		},
		validateQuery: {
			type: Function,
			required: true,
			default: (query) => true,
		},
		liveSearch: {
			type: Boolean,
			default: true,
		},
		transformParams: {
			type: Function,
			default: params => params,
		},
		transformResult: {
			type: Function,
			default: result => result,
		},
	},
	data() {
		return {
			queryParts: {
				filters: {},
				parameters: this.parameters,
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
				},
			},
			queryUrl: this.getUrlQuery(),
			config: Object.assign(
				{},
				defaultOptions,
				this.options,
			),
			states: {
				hasInitialQueryUrl: false,
				hasFetchedOnce: false,
				cancelToken: null,
				loading: false,
				requestType: 'new',
			},
			data: {
				items: [],
				filters: [],
				pagination: {
					limit: null,
					offset: null,
					total: null,
				},
			},
		};
	},
	computed: {
		parametersKeysString() {
			return Object.keys(this.parameters).join(' ');
		},
		filterKeysString() {
			// Kan bruges ved page load med query url
			return this.data.filters.reduce((acc, cur) => {
				acc.push(cur.alias);
				return acc;
			}, []).join(' ');
		},
		initialQueryData() {
			const urlObject = getQueryParams();

			return Object.keys(urlObject).length
				? urlObject
				: null;
		},
		requestQuery() {
			return Object.assign({},
				this.queryParts.parameters,
				this.queryParts.pagination,
				this.queryParts.filters,
			);
		},
		requestString() {
			return this.objectToQueryString({ params: this.requestQuery });
		},
		validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.requestQuery)
				: this.validateQuery;
		},
		enableLiveSearch() {
			return this.config.loadFetch
				? this.liveSearch && this.states.hasFetchedOnce
				: this.liveSearch;
		},
	},
	watch: {
		requestString: function requestString(value, oldValue) {
			if (value !== oldValue) {
				this.requestHub(this.states.requestType);
			}
		},
		'queryParts.parameters': {
			handler() {
				this.states.requestType = 'new';
			},
			deep: true,
		},
		'queryParts.filters': {
			handler() {
				this.states.requestType = 'filter';
			},
			deep: true,
		},
		'states.loading': function(value) {
			this.$emit('isLoading', value);
		},
		'pagination.total': {
			handler(value) {
				this.$emit('itemsCount', value)
			},
			immediate: true,
		},
	},
	mounted() {
		const initialData = getQueryParams();

		if (Object.keys(initialData).length) {
			this.states.hasInitialQueryUrl = true;
			this.hydrateQueryPartsWithUrlData(initialData);
			this.requestHub('new');
		} else if (this.config.immediate) {
			this.request();
		}
	},
	methods: {
		toggleFilterValue(name, value) {
			const tempArray = [...this.queryParts.filters[name]];
			const valueIndex = tempArray.indexOf(value);

			valueIndex === -1
				? tempArray.push(value)
				: tempArray.splice(valueIndex, 1);

			this.$set(this.queryParts.filters, name, tempArray);
		},
		debounce: debounce(function({ cb, args }) {
			cb(args);
		}, 500),
		more(all) {
			const { limit, total, offset } = this.data.pagination;
			const newPagination = {
				limit,
				offset: offset + limit,
				total,
			};

			if (all) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.request('append');
		},
		requestHub(type) {
			if (this.states.hasInitialQueryUrl || (this.enableLiveSearch && this.validQuery)) {
				this.states.loading = true;
				this.debounce({ cb: this.request, args: this.states.requestType });
			} else if (!this.validQuery) {
				// Clear request params from url
				this.setUrlQuery('');
			}
		},
		request(type = 'new', params = this.requestQuery) {
			this.states.loading = true;
			const { total } = this.data.pagination;

			this.fetch(params)
				.then((result) => {
					// const notFirstFetch = total !== null;
					const totalChanged = total !== result.pagination.total;
					const notNewRequest = type !== 'new';
					const notFilterRequest = type !== 'filter';
					const initiateNewFetch = notFilterRequest && notNewRequest && totalChanged;

					if (initiateNewFetch) {
						// if total has changed refetch entire list and replace
						console.log('refetch initiated');
						this.fetch(Object.assign({}, this.requestQuery, {
							limit: this.config.limit,
							offset: 0,
						})).then((secondaryResult) => {
							this.setData(secondaryResult, 'new');
						});
					} else {
						this.setData(result, type);
					}
				})
				.then(() => {
					if (!this.states.hasFetchedOnce) {
						this.states.hasFetchedOnce = true;
					}

					this.queryUrl = this.objectToQueryString({ params, });
				})
				.catch(this.catchError);
		},
		catchError(thrown) {
			// Only remove spinner etc. if request was not cancelled (by a new request)
			if (!axios.isCancel(thrown)) {
				this.states.loading = false;
			}
			// TODO: handle error?⁄
		},
		fetch(params) {
			// Cancel previous request
			if (this.states.cancelToken) {
				this.states.cancelToken.cancel();
			}

			this.states.cancelToken = axios.CancelToken.source();
			this.setUrlQuery(this.requestString);

			const transformedParams = this.transformParams(params);

			return new Promise((resolve, reject) => {
				axios({
					url: this.config.api,
					method: 'GET',
					params: transformedParams,
					paramsSerializer: transformedParams => this.objectToQueryString({
						params: transformedParams,
						addQueryPrefix: false
					}),
					cancelToken: this.states.cancelToken.token,
				}).then((result) => {
					if (result.data) {
						resolve(this.transformResult(result.data));
					}
					reject(result);
				}).catch((err) => {
					reject(err);
				});
			});
		},
		setData(result, type) {
			const { pagination, data, filters } = result;

			switch(type) {
				case 'append':
					this.$set(this.data, 'items', [...this.data.items, ...data]);
					break;

				default:
					this.$set(this.data, 'items', data);
					this.updateFilters(filters);
					break;
			}

			this.updatePaginationParams(pagination);

			this.states.loading = false;
		},
		updateFilters(filters) {
			if (filters) {
				this.$set(this.data, 'filters', filters);

				this.$set(this.queryParts, 'filters', Object.assign({},
					filters.reduce((acc, cur) => {
						acc[cur.alias] = [];

						return acc;
					}, {}),
					this.queryParts.filters,
				));
			}
		},
		updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);

			// Always fetch with the configured limit.
			this.queryParts.pagination.limit = this.config.limit;
			this.queryParts.pagination.offset = pagination.offset;
		},
		objectToQueryString({ params, skipNulls = true, addQueryPrefix = true } = {}) {
			return qs.stringify(params, {
				skipNulls,
				arrayFormat: 'repeat',
				addQueryPrefix,
			});
		},
		queryStringToObject(string) {
			return qs.parse(string);
		},
		getUrlQuery() {
			return typeof window !== 'undefined'
				? window.location.search.replace('?', '')
				: '';
		},
		setUrlQuery(queryString) {
			if (typeof window !== 'undefined') {
				const { protocol, host, pathname } = window.location;
				const newUrl = `${protocol}//${host}${pathname}${queryString}`;

				window.history.replaceState('', '', `${newUrl}`);
			}
		},
		hydrateQueryPartsWithUrlData(data) {
			const notPagination = value => value !== 'limit' && value !== 'offset';

			const hydrationData = Object.keys(data).reduce((acc, cur) => {
				if (this.parametersKeysString.indexOf(cur) !== -1) {
					acc.parameters[cur] = data[cur];
				} else if (notPagination(cur)) {
					acc.filters[cur] = Array.isArray(data[cur])
						? data[cur]
						: [data[cur]];
				}

				return acc;
			},
			{
				parameters: {},
				filters: {},
			});

			this.$set(this.queryParts, 'parameters', hydrationData.parameters);
			this.$set(this.queryParts, 'filters', hydrationData.filters);
		},
	},
};
