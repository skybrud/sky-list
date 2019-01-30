import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
	listType: 'more',
	liveSearch: true,
};

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
			default: () => true,
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
			query: {
				facets: {},
				parameters: this.parameters,
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
				},
			},
			data: {
				items: [],
				facets: [],
				pagination: {
					limit: null,
					offset: null,
					total: null,
				},
			},
			states: {
				hasFetchedOnce: false,
				cancelToken: null,
				loading: false,
			},
			config: Object.assign(
				{},
				defaultOptions,
				this.options,
			),
		};
	},
	watch: {
		'query.parameters': {
			handler() {
				if (this.liveSearchEnabled) {
					this.requestGate();
				}
			},
			deep: true,
		},
		'states.loading': {
			handler(value) {
				this.$emit('isLoading', value);
			},
		},
	},
	computed: {
		validQuery() {
			return (typeof this.validateQuery === 'function')
				? !!this.validateQuery(this.requestQuery)
				: !!this.validateQuery;
		},
		liveSearchEnabled() {
			return this.config.immediate
				? this.config.liveSearch && this.states.hasFetchedOnce
				: this.config.liveSearch;
		},
		requestQuery() {
			return Object.assign({},
				this.query.parameters,
				this.query.facets,
				this.query.pagination,
			);
		},
		urlQueryString() {
			return this.objectToQueryString({ params: this.requestQuery });
		},
	},
	beforeMount() {
		const urlObject = this.getQueryParams();
		const urlObjectKeyArray = Object.keys(urlObject);

		urlObjectKeyArray.forEach((key) => {
			if (this.query.parameters[key] !== undefined) {
				this.query.parameters[key] = urlObject[key];
			} else if (this.query.pagination[key] !== undefined) {
				this.query.pagination[key] = urlObject[key] * 1;
			} else {
				this.query.facets[key] = Array.isArray(urlObject[key])
					? urlObject[key]
					: [urlObject[key]];
			}

			if (!this.config.immediate) {
				this.config.immediate = true;
			}
		});
	},
	mounted() {
		if (this.config.immediate) {
			const shouldPrepend = this.query.pagination.offset
				&& (this.config.listType === 'more'
				|| this.config.listType === 'all');

			if (shouldPrepend) {
				const { offset, limit } = this.query.pagination;
				this.query.pagination.limit = offset + limit;
				this.query.pagination.offset = 0;
			}

			this.request({ params: this.requestQuery })
				.then(() => {
					if (shouldPrepend) {
						const { limit } = this.query.pagination;
						this.query.pagination.offset = limit - this.config.limit;
						this.query.pagination.limit = this.config.limit;

						this.setUrlQuery(this.urlQueryString);
					}
				});
		}
	},
	methods: {
		debounce: debounce(({ cb, args }) => {
			cb(args);
		}, 500),
		requestGate({ type = 'new', params = this.requestQuery } = {}) {
			if (this.validQuery) {
				this.debounce({ cb: this.request, args: { params, type } });
			} else {
				this.resetQueryAndData();
				this.setUrlQuery('');
			}
		},
		resetQueryAndData() {
			Object.keys(this.query.facets).forEach((key) => {
				this.query.facets[key].splice(0);
			});

			this.query.pagination.limit = this.config.limit;
			this.query.pagination.offset = 0;

			this.data.items.splice(0);

			this.data.pagination.limit = null;
			this.data.pagination.offset = null;
			this.data.pagination.total = null;
		},
		all() {
			this.more(true);
		},
		more(all) {
			const { limit, total, offset } = this.data.pagination;
			const newPagination = {
				limit,
				offset: offset + limit,
				total,
			};

			if (all === true) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.requestGate({ type: 'append' });
		},
		setValue(key, value, queryPart = 'facets') {
			this.$set(this.query[queryPart], key, value);
		},
		toggleValue(key, value, queryPart = 'facets') {
			const tempArray = [...this.query[queryPart][key]];
			const valueIndex = tempArray.indexOf(`${value}`);

			valueIndex === -1
				? tempArray.push(`${value}`)
				: tempArray.splice(valueIndex, 1);

			this.$set(this.query[queryPart], key, tempArray);

			if (this.liveSearchEnabled) {
				this.requestGate();
			}
		},
		objectToQueryString({ params, skipNulls = true, addQueryPrefix = true } = {}) {
			return qs.stringify(params, {
				skipNulls,
				arrayFormat: 'repeat',
				addQueryPrefix,
			});
		},
		request({ params = this.requestQuery, type = 'new' } = {}) {
			this.states.loading = true;
			const { total } = this.data.pagination;

			return this.fetch(params)
				.then((result) => {
					const notNewRequest = type !== 'new';
					const totalChanged = total !== result.pagination.total;
					const initiateNewFetch = notNewRequest && totalChanged;

					if (initiateNewFetch) {
						// if total has changed refetch entire list and replace
						console.log('[SkyList]: refetch initiated');
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

			this.setUrlQuery(this.urlQueryString);

			const transformedParams = this.transformParams(params);

			return new Promise((resolve, reject) => {
				axios({
					url: this.config.api,
					method: 'GET',
					params: transformedParams,
					paramsSerializer: transformedParameters => this.objectToQueryString({
						params: transformedParameters,
						addQueryPrefix: false,
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
			const { pagination, data, facets } = result;

			switch (type) {
			case 'append':
				this.$set(this.data, 'items', [...this.data.items, ...data]);
				break;

			default:
				this.$set(this.data, 'items', data);
				this.updateFacets(facets);
				break;
			}

			this.updatePaginationParams(pagination);

			this.states.loading = false;
		},
		getQueryParams() {
			if (typeof window !== 'undefined') {
				const q = window.location.search.replace('?', '');
				return qs.parse(q);
			}

			return {};
		},
		setUrlQuery(queryString) {
			if (typeof window !== 'undefined') {
				const { protocol, host, pathname } = window.location;
				const newUrl = `${protocol}//${host}${pathname}${queryString}`;

				window.history.replaceState('', '', `${newUrl}`);
			}
		},
		updateFacets(facets) {
			if (facets) {
				this.$set(this.data, 'facets', facets);

				this.$set(this.query, 'facets', Object.assign({},
					facets.reduce((acc, cur) => {
						acc[cur.alias] = [];

						return acc;
					}, {}),
					this.query.facets,
				));
			}
		},
		updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);
			this.$set(this.query, 'pagination', {
				limit: pagination.limit,
				offset: pagination.offset,
			});
		},
	},
};
