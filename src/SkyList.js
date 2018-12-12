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
			query: Object.assign(
				{},
				this.parameters,
				getQueryParams(), // initiate with query params from url
				{ limit: this.options.limit || defaultOptions.limit },
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
					limit: null,
					offset: null,
					total: null,
				},
			},
		};
	},
	computed: {
		validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.query)
				: this.validateQuery;
		},
		enableLiveSearch() {
			return this.config.loadFetch
				? this.liveSearch && this.states.hasFetchedOnce
				: this.liveSearch;
		},
		forceFetchFromOffsetZero() {
			return this.config.listType === 'more' && this.query.offset > 0;
		},
	},
	watch: {
		'states.loading': function(value) {
			value
				? this.$emit('loadingBegin')
				: this.$emit('loadingEnd');
		},
		query: {
			handler() {
				if (this.enableLiveSearch && this.validQuery) {
					this.states.loading = true;
					this.debounce(this.request);
				} else if (!this.validQuery) {
					// Clear request params from url
					this.updateUrlParams({});
				}
			},
			deep: true,
		},
	},
	mounted() {
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		if (this.config.immediate || this.validQuery) {
			!this.forceFetchFromOffsetZero
				? this.request()
				: this.request('new', Object.assign(
					{},
					this.query,
					{
						limit: Number(this.query.offset) + Number(this.query.limit),
						offset: 0,
					},
				));
		}
	},
	methods: {
		debounce: debounce(function(cb) {
			cb();
		}, 500),
		more(all) {
			const { limit, total, offset } = this.result.pagination;
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
		request(type = 'new', params = this.query) {
			this.states.loading = true;
			const { total } = this.result.pagination;

			this.fetch(params)
				.then((result) => {
					const notFirstFetch = total !== null;
					const totalChanged = total !== result.pagination.total;
					const notNewRequest = type !== 'new';

					if (notFirstFetch && notNewRequest && totalChanged) {
						// if total has changed refetch entire list and replace
						console.log('refetch initiated');
						this.fetch(Object.assign({}, this.query, {
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
				case 'append':
					this.$set(this.result, 'data', [...this.result.data, ...data])
					break;

				default:
					this.$set(this.result, 'data', data);
					break;
			}

			this.updatePaginationParams(pagination);

			this.states.loading = false;
		},
		updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams(pagination) {
			this.$set(this.result, 'pagination', pagination);

			// Always fetch with the configured limit.
			this.query.limit = this.config.limit;
			this.query.offset = pagination.offset;
		},
	},
};
