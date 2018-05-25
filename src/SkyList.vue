<script>
import axios from 'axios';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	showCount: false,
	filterType: 'request',
	paginationType: 'more', // navigation | pagination | more | all
	loadFetch: false,
};

const defaultParams = {
	keywords: '',
};

export default {
	props: {
		// Value map is used for fetching vue-multiselect value
		valueMap: {
			type: Object,
			default: () => ({}),
		},
		filter: {
			type: Object,
			default: () => ({}),
		},
		parameters: {
			type: Object,
			default: () => ({}),
		},
		options: {
			type: Object,
			default: () => ({}),
		},
		validateQuery: {
			type: [Boolean, Function],
			default: false,
		},
	},
	data() {
		return {
			previousQuery: {},
			query: Object.assign({}, defaultParams, this.filter, this.parameters),
			config: Object.assign({}, defaultOptions, this.options),
			states: {
				hasFetchedOnce: false,
				cancelToken: null,
				loading: true,
			},
			result: {
				data: [],
				groups: [],
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
					total: null,
				},
			},
		};
	},
	computed: {
		filterKeys() {
			return Object.keys(this.filter);
		},
		itemsLeft() {
			// Provides the amount of items not displayed yet.
			const { limit, offset, total } = this.result.pagination;

			return (offset + limit) - total < limit
				? total - (offset + limit)
				: limit;
		},
		currentResultSet() {
			// Showing the part of the complete resultset currently wanted.
			// TODO: 0 must be refactored when pagination is implementet
			const endIndex = this.result.pagination.limit + this.result.pagination.offset;
			return this.result.data
				.slice(0, endIndex);
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
			return Object.assign({}, {
				limit: this.result.pagination.limit,
				offset: this.result.pagination.offset,
			},
			this.queryFlatArrays);
		},
	},
	watch: {
		query: {
			handler(current) {
				if (this.validQuery) {
					Object.keys(this.query).forEach((key) => {
						const changedKey = current[key] !== this.previousQuery[key];
						const isFilterKey = this.filterKeys.includes(key);

						if (changedKey && isFilterKey) {
							this.request('filter');
						} else if (changedKey) {
							this.request();
						}

						if (changedKey) {
							Object.assign(this.previousQuery, this.query);
						}
					});
				} else {
					this.resetQuery();
				}
			},
			deep: true,
		},
	},
	mounted() {
		if (this.config.loadFetch) {
			this.request();
		}
	},
	methods: {
		nativeSearchHandling() {
			this.validQuery
				// Handle pressing enter
				? this.request()
				// Handle clearing input
				: this.resetQuery();
		},
		more(all) {
			const { limit, total } = this.result.pagination;

			this.result.pagination.offset += limit;

			if (all) {
				this.result.pagination.limit = total - this.result.pagination.offset;
			}

			this.request('append');
		},
		request(type = 'clean') {
			this.states.loading = true;
			const { total } = this.result.pagination;

			if (!this.states.hasFetchedOnce) {
				this.states.hasFetchedOnce = true;
			}

			this.fetch().then((result) => {
				const totalChanged = total !== result.data.pagination.total;
				const notFirstFetch = total !== null;
				const filterNotRequested = type !== 'filter';

				if (filterNotRequested && notFirstFetch && totalChanged) {
					// if total has changed refetch entire list and replace
					this.fetch(Object.assign({}, this.requestParams, {
						limit: this.limitEnd, // hvorfor limit = limitEnd?
						offset: 0,
					})).then(this.dataParser);
				} else {
					this.dataParser(result, type);
				}
			}).catch(this.catchError);
		},
		catchError(thrown) {
			// Only remove spinner etc. if request was not cancelled (by a new request)
			if (!axios.isCancel(thrown)) {
				this.states.loading = false;
			}
			// TODO: handle error?⁄
		},
		dataParser(result, type = 'clean') {
			const { data, pagination, areas } = result.data;

			const dataActions = {
				append: () => {
					// Append fetched result to existing.
					this.setResultData(this.result.data.concat(data));
				},
				prepend: () => {
					// Prepend fetched result to existing.
					this.setResultData(data.concat(this.result.data));
				},
				clean: () => {
					// Reset result object to newly fetched result.
					this.setResultData(data);
					this.setPagination({ offset: 0, total: pagination.total });
					this.setGroups(areas);
				},
				filter: () => {
					// Does not alter group info.
					this.setResultData(data);
					this.setPagination({ offset: 0, total: pagination.total });
				},
			};

			dataActions[type]();

			this.states.loading = false;
		},
		fetch(params = this.requestParams) {
			// Cancel previous request
			if (this.states.cancelToken) {
				this.states.cancelToken.cancel();
			}

			this.states.cancelToken = axios.CancelToken.source();

			return axios({
				url: this.config.api,
				method: 'GET',
				params,
				cancelToken: this.states.cancelToken.token,
			});
		},
		resetQuery() {
			this.filterKeys.forEach((param) => {
				this.query[param] = this.filter[param];
			});

			this.setPagination({ offset: 0, total: 0 });
		},
		setGroups(groups) {
			this.$set(this.result, 'groups', groups);
		},
		setPagination(pagination) {
			this.$set(this.result, 'pagination', Object.assign(this.result.pagination, pagination));
		},
		setResultData(data) {
			this.$set(this.result, 'data', data);
		},
	},
};
</script>

<style src='./SkyList.scss'></style>
<template src='./SkyList.html'></template>
