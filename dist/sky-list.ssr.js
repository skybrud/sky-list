'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var axios = _interopDefault(require('axios'));
var qs = _interopDefault(require('qs'));
var debounce = _interopDefault(require('debounce'));

var defaultOptions = {
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
		var q = window.location.search.replace('?', '');
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

var script = {
	name: 'SkyList',
	props: {
		// Set up parameters to v-model
		parameters: {
			type: Object,
			default: function () { return ({}); },
		},
		options: {
			type: Object,
			default: function () { return ({}); },
		},
		validateQuery: {
			type: Function,
			required: true,
			default: function (query) { return true; },
		},
		liveSearch: {
			type: Boolean,
			default: true,
		},
		transformParams: {
			type: Function,
			default: function (params) { return params; },
		},
		transformResult: {
			type: Function,
			default: function (result) { return result; },
		},
	},
	data: function data() {
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
				this.options
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
		parametersKeysString: function parametersKeysString() {
			return Object.keys(this.parameters).join(' ');
		},
		filterKeysString: function filterKeysString() {
			// Kan bruges ved page load med query url
			return this.data.filters.reduce(function (acc, cur) {
				acc.push(cur.alias);
				return acc;
			}, []).join(' ');
		},
		initialQueryData: function initialQueryData() {
			var urlObject = getQueryParams();

			return Object.keys(urlObject).length
				? urlObject
				: null;
		},
		requestQuery: function requestQuery() {
			return Object.assign({},
				this.queryParts.parameters,
				this.queryParts.pagination,
				this.queryParts.filters
			);
		},
		requestString: function requestString() {
			return this.objectToQueryString({ params: this.requestQuery });
		},
		validQuery: function validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.requestQuery)
				: this.validateQuery;
		},
		enableLiveSearch: function enableLiveSearch() {
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
			handler: function handler() {
				this.states.requestType = 'new';
			},
			deep: true,
		},
		'queryParts.filters': {
			handler: function handler() {
				this.states.requestType = 'filter';
			},
			deep: true,
		},
		'states.loading': function(value) {
			this.$emit('isLoading', value);
		},
		'data.pagination.total': {
			handler: function handler(value) {
				this.$emit('itemsCount', value);
			},
			immediate: true,
		},
	},
	mounted: function mounted() {
		var initialData = getQueryParams();

		if (Object.keys(initialData).length) {
			this.states.hasInitialQueryUrl = true;
			this.hydrateQueryPartsWithUrlData(initialData);
			this.requestHub('new');
		} else if (this.config.immediate) {
			this.request();
		}
	},
	methods: {
		toggleFilterValue: function toggleFilterValue(name, value) {
			var tempArray = [].concat( this.queryParts.filters[name] );
			var valueIndex = tempArray.indexOf(value);

			valueIndex === -1
				? tempArray.push(value)
				: tempArray.splice(valueIndex, 1);

			this.$set(this.queryParts.filters, name, tempArray);
		},
		debounce: debounce(function(ref) {
			var cb = ref.cb;
			var args = ref.args;

			cb(args);
		}, 500),
		more: function more(all) {
			var ref = this.data.pagination;
			var limit = ref.limit;
			var total = ref.total;
			var offset = ref.offset;
			var newPagination = {
				limit: limit,
				offset: offset + limit,
				total: total,
			};

			if (all) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.request('append');
		},
		requestHub: function requestHub(type) {
			if (this.states.hasInitialQueryUrl || (this.enableLiveSearch && this.validQuery)) {
				this.states.loading = true;
				this.debounce({ cb: this.request, args: this.states.requestType });
			} else if (!this.validQuery) {
				// Clear request params from url
				this.setUrlQuery('');
			}
		},
		request: function request(type, params) {
			var this$1 = this;
			if ( type === void 0 ) type = 'new';
			if ( params === void 0 ) params = this.requestQuery;

			this.states.loading = true;
			var ref = this.data.pagination;
			var total = ref.total;

			this.fetch(params)
				.then(function (result) {
					// const notFirstFetch = total !== null;
					var totalChanged = total !== result.pagination.total;
					var notNewRequest = type !== 'new';
					var notFilterRequest = type !== 'filter';
					var initiateNewFetch = notFilterRequest && notNewRequest && totalChanged;

					if (initiateNewFetch) {
						// if total has changed refetch entire list and replace
						console.log('refetch initiated');
						this$1.fetch(Object.assign({}, this$1.requestQuery, {
							limit: this$1.config.limit,
							offset: 0,
						})).then(function (secondaryResult) {
							this$1.setData(secondaryResult, 'new');
						});
					} else {
						this$1.setData(result, type);
					}
				})
				.then(function () {
					if (!this$1.states.hasFetchedOnce) {
						this$1.states.hasFetchedOnce = true;
					}

					this$1.queryUrl = this$1.objectToQueryString({ params: params, });
				})
				.catch(this.catchError);
		},
		catchError: function catchError(thrown) {
			// Only remove spinner etc. if request was not cancelled (by a new request)
			if (!axios.isCancel(thrown)) {
				this.states.loading = false;
			}
			// TODO: handle error?⁄
		},
		fetch: function fetch(params) {
			var this$1 = this;

			// Cancel previous request
			if (this.states.cancelToken) {
				this.states.cancelToken.cancel();
			}

			this.states.cancelToken = axios.CancelToken.source();
			this.setUrlQuery(this.requestString);

			var transformedParams = this.transformParams(params);

			return new Promise(function (resolve, reject) {
				axios({
					url: this$1.config.api,
					method: 'GET',
					params: transformedParams,
					paramsSerializer: function (transformedParams) { return this$1.objectToQueryString({
						params: transformedParams,
						addQueryPrefix: false
					}); },
					cancelToken: this$1.states.cancelToken.token,
				}).then(function (result) {
					if (result.data) {
						resolve(this$1.transformResult(result.data));
					}
					reject(result);
				}).catch(function (err) {
					reject(err);
				});
			});
		},
		setData: function setData(result, type) {
			var pagination = result.pagination;
			var data = result.data;
			var filters = result.filters;

			switch(type) {
				case 'append':
					this.$set(this.data, 'items', this.data.items.concat( data));
					break;

				default:
					this.$set(this.data, 'items', data);
					this.updateFilters(filters);
					break;
			}

			this.updatePaginationParams(pagination);

			this.states.loading = false;
		},
		updateFilters: function updateFilters(filters) {
			if (filters) {
				this.$set(this.data, 'filters', filters);

				this.$set(this.queryParts, 'filters', Object.assign({},
					filters.reduce(function (acc, cur) {
						acc[cur.alias] = [];

						return acc;
					}, {}),
					this.queryParts.filters
				));
			}
		},
		updateUrlParams: function updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams: function updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);

			// Always fetch with the configured limit.
			this.queryParts.pagination.limit = this.config.limit;
			this.queryParts.pagination.offset = pagination.offset;
		},
		objectToQueryString: function objectToQueryString(ref) {
			if ( ref === void 0 ) ref = {};
			var params = ref.params;
			var skipNulls = ref.skipNulls; if ( skipNulls === void 0 ) skipNulls = true;
			var addQueryPrefix = ref.addQueryPrefix; if ( addQueryPrefix === void 0 ) addQueryPrefix = true;

			return qs.stringify(params, {
				skipNulls: skipNulls,
				arrayFormat: 'repeat',
				addQueryPrefix: addQueryPrefix,
			});
		},
		queryStringToObject: function queryStringToObject(string) {
			return qs.parse(string);
		},
		getUrlQuery: function getUrlQuery() {
			return typeof window !== 'undefined'
				? window.location.search.replace('?', '')
				: '';
		},
		setUrlQuery: function setUrlQuery(queryString) {
			if (typeof window !== 'undefined') {
				var ref = window.location;
				var protocol = ref.protocol;
				var host = ref.host;
				var pathname = ref.pathname;
				var newUrl = protocol + "//" + host + pathname + queryString;

				window.history.replaceState('', '', ("" + newUrl));
			}
		},
		hydrateQueryPartsWithUrlData: function hydrateQueryPartsWithUrlData(data) {
			var this$1 = this;

			var notPagination = function (value) { return value !== 'limit' && value !== 'offset'; };

			var hydrationData = Object.keys(data).reduce(function (acc, cur) {
				if (this$1.parametersKeysString.indexOf(cur) !== -1) {
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

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:['sky-list', { loading : _vm.states.loading }]},[_vm._t("default",null,{query:{
			parameters: _vm.queryParts.parameters,
			filters: _vm.queryParts.filters,
		},result:_vm.data.items,filters:_vm.data.filters,states:_vm.states,pagination:_vm.data.pagination,fetch:_vm.more,toggleFilter:_vm.toggleFilterValue})],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = "data-v-365566a3";
  /* functional template */
  var __vue_is_functional_template__ = false;
  /* component normalizer */
  function __vue_normalize__(
    template, style, script$$1,
    scope, functional, moduleIdentifier,
    createInjector, createInjectorSSR
  ) {
    var component = (typeof script$$1 === 'function' ? script$$1.options : script$$1) || {};

    // For security concerns, we use only base name in production mode.
    component.__file = "SkyList.vue";

    if (!component.render) {
      component.render = template.render;
      component.staticRenderFns = template.staticRenderFns;
      component._compiled = true;

      if (functional) { component.functional = true; }
    }

    component._scopeId = scope;

    return component
  }
  /* style inject */
  
  /* style inject SSR */
  

  
  var SkyList = __vue_normalize__(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    undefined
  );

var defaults = {
	registerComponents: true,
};

function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	var ref = Object.assign({}, defaults, options);
	var registerComponents = ref.registerComponents;

	if (registerComponents) {
		Vue.component(SkyList.name, SkyList);
	}
}

exports.SkyList = SkyList;
exports.default = install;
