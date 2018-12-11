import axios from 'axios';
import qs from 'qs';
// import debounce from 'debounce';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
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
		const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
		const qString = qs.stringify(params, { skipNulls });
		const q = qString ? `?${qString}` : '';
		window.history.replaceState('', '', `${baseUrl}${q}`);
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
			previousQuery: {},
			query: Object.assign(
				{},
				this.parameters,
				getQueryParams(), // initiate with query params from url
			),
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
			result: {
				data: [],
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
					total: null,
				},
			},
		};
	},
	computed: {
		// validQuery() {
		// 	return (typeof this.validateQuery === 'function')
		// 		? this.validateQuery(this.query)
		// 		: this.validateQuery;
		// },
	},
	mounted() {
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		this.request();
	},
	methods: {
		more(all) {
			const { limit, total, offset } = this.result.pagination;
			const newPagination = { offset: offset + limit, total };

			if (all) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.request('append');
		},
		request(type = 'initial') {
			this.states.loading = true;
			const { total, offset } = this.result.pagination;

			this.fetch()
				.then((result) => {
					const firstFetch = total === null || offset === 0;
					const totalChanged = total !== result.pagination.total;
					const filterNotRequested = type !== 'filter';

					if (!firstFetch && totalChanged && filterNotRequested) {
						// if total has changed refetch entire list and replace
						console.log('refetch initiated');
						this.fetch(Object.assign({}, this.query, {
							limit: this.limitEnd, // hvorfor limit = limitEnd?
							offset: 0,
						})).then((secondaryResult) => {
							this.setData(secondaryResult, 'initial');
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
		fetch(params = this.query) {
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

			if (type = 'append') {
				this.$set(this.result, 'data', [...this.result.data, ...data]);
			}

			this.$set(this.result, 'data', data);

			this.updatePaginationParams(pagination);
		},
		updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams(pagination) {
			this.$set(this.result, 'pagination', pagination);
			this.query.limit = pagination.limit;
			this.query.offset = pagination.offset;
		},
	},
};
