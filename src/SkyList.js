import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
	listType: 'more',
};

function getQueryParams() {
	if (typeof window !== 'undefined') {
		const q = window.location.search.replace('?', '');
		return qs.parse(q);
	}

	return {};
}

function setQueryParams(params, skipNulls = true) {
	if (typeof window !== 'undefined') {
		const { protocol, host, pathname } = window.location;
		const newUrl = `${protocol}//${host}${pathname}${qs.stringify(params, {
			skipNulls,
			arrayFormat: 'repeat',
			addQueryPrefix: true,
		})}`;

		window.history.replaceState('', '', `${newUrl}`);
	}
}

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
				// previous: null,
				url: getQueryParams(),
			},
			config: Object.assign(
				{},
				defaultOptions,
				this.options,
			),
			states: {
				hasFetchedOnce: false,
				cancelToken: null,
				loading: false,
			},
			data: {
				items: [],
				filters: null,
				pagination: {
					limit: null,
					offset: null,
					total: null,
				},
			},
		};
	},
	computed: {
		requestQuery() {
			const nonUrlQuery = Object.assign({},
				this.queryParts.parameters,
				this.queryParts.pagination
			);

			const queryUrlKeys = Object.keys(this.queryParts.url);

			if (!this.states.hasFetchedOnce && queryUrlKeys.length) {
				const urlQueryFilters = queryUrlKeys
					.filter(key => Object.keys(nonUrlQuery).join(' ').indexOf(key) === -1)
					.reduce((acc, cur) => {
						const curValue = this.queryParts.url[cur];
						acc[cur] = Array.isArray(curValue)
							? [...curValue]
							: [curValue];

						return acc;
					}, {});

				this.$set(this.queryParts, 'filters', urlQueryFilters);

				return Object.assign({},
					this.queryParts.url,
					{ limit: this.queryParts.pagination.limit }
				);
			}

			return nonUrlQuery;
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
		forceFetchFromOffsetZero() {
			return this.config.listType === 'more' && this.requestQuery.offset > 0;
		},
	},
	watch: {
		'queryParts.parameters': {
			handler() {
				console.log('QP parameters');
				this.requestHub('new');
			},
			deep: true,
		},
		'queryParts.filters': {
			handler() {
				console.log('QP filters');
				this.requestHub('filter');
			},
			deep: true,
		},
		'states.loading': function(value) {
			value
				? this.$emit('loadingBegin')
				: this.$emit('loadingEnd');
		},
	},
	mounted() {
		// TODO: REFACTOR INFO MORE ELEGANT FORM
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		if (this.config.immediate || this.validQuery) {
			!this.forceFetchFromOffsetZero
				? this.request()
				: this.request('new', Object.assign(
					{},
					this.requestQuery,
					{
						limit: Number(this.requestQuery.offset) + Number(this.requestQuery.limit),
						offset: 0,
					},
				));
		}
	},
	methods: {
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
			if (this.enableLiveSearch && this.validQuery) {
				this.states.loading = true;
				this.debounce({ cb: this.request, args: [type] });
			} else if (!this.validQuery) {
				// Clear request params from url
				this.updateUrlParams({});
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

			// Update url with request params
			this.updateUrlParams(params);

			return new Promise((resolve, reject) => {
				axios({
					url: this.config.api,
					method: 'GET',
					params: this.transformParams(params),
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
				case 'new':
					this.$set(this.data, 'items', data);
					this.updateFilters(filters);
					break;

				default:
					this.$set(this.data, 'items', this.data.items.concat( data));
					break;
			}

			this.updatePaginationParams(pagination);

			this.states.loading = false;
		},
		updateFilters(filters) {
			if (filters && filters.length) {
				this.$set(this.data, 'filters', filters);

				const compiledFilter = {};

				for (let i = filters.length - 1; i >= 0; i--) {
					const curValue = this.queryParts.filters[filters[i].alias];

					compiledFilter[filters[i].alias] = !this.states.hasFetchedOnce && curValue
						? [...curValue]
						: [];
				}

				this.$set(this.queryParts, 'filters', compiledFilter);
			}
		},
		updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);

			// Always fetch with the configured limit.
			this.requestQuery.limit = this.config.limit;
			this.requestQuery.offset = pagination.offset;
		},
	},
};
