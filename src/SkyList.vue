<script>
import axios from 'axios';

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	showCount: false,
	filterType: 'request',
	paginationType: 'more', // navigation | pagination | more | all | numeric
	loadFetch: false,
};

export default {
	props: {
		// override query with external values
		query: {
			type: Object,
			default: () => ({}),
		},
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
			default: () => ({
				keywords: '',
			}),
		},
		options: {
			type: Object,
			default: () => ({}),
		},
		validateQuery: {
			type: Function,
			default: query => query.keywords,
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
			listQuery: Object.assign(
				{},
				this.filter,
				this.parameters,
				this.query,
				(this.$route) ? this.$route.query : {}, // initiate with query params from url
			),
			config: Object.assign(
				{},
				defaultOptions,
				this.options,
			),
			states: {
				hasFetchedOnce: false,
				cancelToken: null,
				loading: true,
			},
			pages: {
				max: 1,
				current: 1,
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
		numericPagination() {
			return (this.config.paginationType === 'numeric') || (this.config.paginationType === 'pagination');
		},
		flowPagination() {
			return (this.config.paginationType === 'navigation') || (this.config.paginationType === 'pagination');
		},
		morePagination() {
			return (this.config.paginationType === 'more') || (this.config.paginationType === 'all');
		},
		showPagination() {
			if (!this.states.hasFetchedOnce) {
				return false;
			}
			if (this.morePagination) {
				return this.canFetchMore;
			}
			return this.pages.max > 1;
		},
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
		resultStartIndex() {
			if (this.morePagination) {
				return 0;
			}

			return (this.pages.current - 1) * this.config.limit;
		},
		resultEndIndex() {
			const { pagination: { offset, limit, total } } = this.result;
			if (total === null) {
				return offset + limit;
			}

			return Math.min(offset + limit, total);
		},
		currentResultSet() {
			// Showing the part of the complete resultset currently wanted.
			const { data } = this.result;

			return data[this.pageNoToIndex(this.getCurrentPage())] || [];
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

			Object.keys(this.listQuery).forEach((key) => {
				if (Array.isArray(this.listQuery[key])) {
					res[key] = this.listQuery[key]
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
						? this.listQuery[key]
						: this.listQuery[key][this.valueMap[key]];
				}
			});
			return res;
		},
		validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.listQuery)
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
			handler() {
				this.$set(this, 'listQuery', Object.assign({}, this.filter, this.parameters, this.query));
			},
			deep: true,
		},
		listQuery: {
			handler() {
				if (this.liveSearch && this.validQuery) {
					this.handleUserSearch();
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
		if (this.config.loadFetch || this.validQuery) {
			this.request();
		}
	},
	methods: {
		handleUserSearch() {
			if (this.validQuery) {
				Object.keys(this.listQuery).forEach((key) => {
					const changedKey = this.listQuery[key] !== this.previousQuery[key];
					const isFilterKey = this.filterKeys.includes(key);

					if (changedKey && isFilterKey) {
						this.filterData();
					} else if (changedKey) {
						this.request();
					}

					if (changedKey) {
						Object.assign(this.previousQuery, this.listQuery);
					}
				});
			} else {
				this.resetPagination();
			}
		},
		nativeSearchHandling() {
			this.validQuery
				// Handle pressing enter
				? this.request()
				// Handle clearing input
				: this.resetPagination();
		},
		setCurrentPage(pageNo) {
			this.pages.current = pageNo;
		},
		getCurrentPage() {
			return this.pages.current;
		},
		pageNoToIndex(value) {
			return value ? --value : 0;
		},
		requestedPageIsFetched(pageNoRequested) {
			const { data } = this.result;

			return data[pageNoRequested - 1];
		},
		filterData() {
			const { groups, pagination: { total } } = this.result;

			const currentArea = groups
				? groups.find(area => area.id === this.listQuery.area)
				: null;
			const currentAreaCount = (currentArea && currentArea.count)
				? currentArea.count
				: total;

			this.setCurrentPage(1);
			this.setPagination({ offset: 0, total: currentAreaCount });

			this.request('filter');
		},
		more(all) {
			const { limit, total, offset } = this.result.pagination;
			const newPagination = { offset: offset + limit };

			if (all) {
				newPagination.limit = total - offset;
			}

			this.setPagination(newPagination);

			this.request('append');
		},
		goTo(target) {
			const { limit, offset } = this.result.pagination;

			if (target === 'next') {
				this.setCurrentPage(Math.min(this.getCurrentPage() + 1, this.pages.max));
				this.setPagination({ offset: offset + limit });
			}

			if (target === 'previous') {
				this.setCurrentPage(Math.min(this.getCurrentPage() - 1, this.pages.max));
				this.setPagination({ offset: Math.max(offset - limit, 0) });
			}

			if (Number(target)) {
				this.setCurrentPage(target);
				this.setPagination({ offset: (this.getCurrentPage() - 1) * limit });
			}

			if (!this.requestedPageIsFetched(this.getCurrentPage())) {
				this.request('page', this.getCurrentPage());
			}
		},
		request(type = 'clean', pageNo = 1) {
			this.states.loading = true;
			const { total, offset } = this.result.pagination;

			if (!this.states.hasFetchedOnce) {
				this.states.hasFetchedOnce = true;
			}

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
							this.dataParser(secondaryResult, type, pageNo);
						});
					} else {
						this.dataParser(result, type, pageNo);
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
		dataParser(result, type = 'clean', pageNo) {
			const { data, pagination, areas } = result;

			this.pages.max = Math.ceil(pagination.total / pagination.limit);

			const dataActions = {
				append: () => {
					// Append fetched result to existing.
					this.setResultData([...this.result.data[0], ...data]);
				},
				page: () => {
					this.setResultData(data, this.pageNoToIndex(pageNo));
				},
				clean: () => {
					// Reset result object to newly fetched result.
					this.setResultData(data, this.pageNoToIndex(pageNo));
					this.setPagination({ offset: 0, total: pagination.total });
					this.setGroups(areas);
				},
				filter: () => {
					// Resets all, but group info and query
					this.deleteResultData();

					this.setResultData(data, this.pageNoToIndex(pageNo));
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
			if (this.$route && this.$router) {
				this.$router.replace({ path: this.$route.path, query: params })
			}
		},
		resetQuery() {
			this.filterKeys.forEach((param) => {
				this.listQuery[param] = this.filter[param];
			});

			this.resetPagination();
		},
		resetPagination() {
			this.setPagination({ offset: 0, total: 0 });
		},
		setGroups(groups) {
			this.$set(this.result, 'groups', groups);
		},
		setPagination(pagination) {
			this.$set(this.result, 'pagination', Object.assign(this.result.pagination, pagination));
		},
		setResultData(data, index = 0) {
			for (let i = 0; i < index; i++) {
				if (!this.result.data[i]) {
					this.result.data.splice(i, 1, null);
				}
			}

			this.result.data.splice(index, 1, data);
		},
		deleteResultData() {
			this.result.data.splice(0);
		},
	},
};
</script>

<style src='./SkyList.scss'></style>
<template src='./SkyList.html'></template>
