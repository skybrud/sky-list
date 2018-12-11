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
			default: (query) => query.keywords,
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
				// groups: [],
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
					total: null,
				},
			},
		};
	},
	computed: {
		itemsLeft() {
			// Provides the amount of items not displayed yet.
			const { limit, offset, total } = this.result.pagination;

			return (offset + limit) - total < limit
				? total - (offset + limit)
				: limit;
		},
		// resultStartIndex() {
		// 	if (this.morePagination) {
		// 		return 0;
		// 	}

		// 	return (this.pages.current - 1) * this.config.limit;
		// },
		// resultEndIndex() {
		// 	const { pagination: { offset, limit, total } } = this.result;
		// 	if (total === null) {
		// 		return offset + limit;
		// 	}

		// 	return Math.min(offset + limit, total);
		// },
		currentResultSet() {
			// Showing the part of the complete resultset currently wanted.
			const { data } = this.result;

			return data;
		},
		limitEnd() {
			return this.result.pagination.offset + this.result.pagination.limit;
		},
		canFetchMore() {
			return this.limitEnd < this.result.pagination.total;
		},
		queryFlatArrays() {
			// We loop through the query and join all arrays to strings
			const res = {};
			const extractObjectKey = Object.keys(this.valueMap);

			Object.keys(this.query).forEach((key) => {
				if (Array.isArray(this.query[key])) {
					res[key] = this.query[key]
						.map((queryProperty) => {
							// if queryProperty contains a 'value' property return that
							if (queryProperty && typeof queryProperty.value !== 'undefined') {
								return queryProperty.value;
							}
							return queryProperty;
						})
						.join(',');
				} else {
					/**
							 * Avoid objects being send as parameter
							 * and use exposed value mapping for grapping object value.
							 */
					res[key] = !extractObjectKey.includes(key)
						? this.query[key]
						: this.query[key][this.valueMap[key]];
				}
			});
			return res;
		},
		validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.query)
				: this.validateQuery;
		},
		requestParams() {
			const rp = Object.assign({}, this.queryFlatArrays, {
				limit: this.result.pagination.limit,
				offset: this.result.pagination.offset,
			});

			return rp;
		},
	},
	// watch: {
	// 	query: {
	// 		handler() {
	// 			if (this.liveSearch && this.validQuery) {
	// 				this.handleUserSearch();
	// 			} else if (!this.validQuery) {
	// 				// Clear request params from url
	// 				this.updateUrlParams({});
	// 			}
	// 		},
	// 		deep: true,
	// 	},
	// 	'states.loading': function(value) {
	// 		if (value) {
	// 			this.$emit('loadingBegin');
	// 		} else {
	// 			this.$emit('loadingEnd');
	// 		}
	// 	},
	// 	result: {
	// 		handler(value) {
	// 			this.$emit('result', value);
	// 		},
	// 		deep: true,
	// 	},
	// },
	mounted() {
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		if (this.config.immediate || this.validQuery) {
			this.request();
		}
	},
	methods: {
		more(all) {

		},
		request(type = 'clean') {
			this.states.loading = true;
			const { total, offset } = this.result.pagination;

			this.fetch()
				.then((result) => {
					const firstFetch = total === null || offset === 0;
					const totalChanged = total !== result.pagination.total;
					const filterNotRequested = type !== 'filter';

					if (!firstFetch && totalChanged && filterNotRequested) {
						// if total has changed refetch entire list and replace
						this.fetch(Object.assign({}, this.requestParams, {
							limit: this.limitEnd, // hvorfor limit = limitEnd?
							offset: 0,
						})).then((secondaryResult) => {
							this.$set(this.result, 'data', result.data);
						});
					} else {
						this.$set(this.result, 'data', result.data);
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
		fetch(params = this.requestParams) {
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
		updateUrlParams(params) {
			setQueryParams(params);
		},
	},
};
