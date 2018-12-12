import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

var defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
	listType: 'more',
};

function getQueryParams() {
	if (typeof window !== 'undefined') {
		var q = window.location.search.replace('?', '');
		return qs.parse(q);
	}

	return {};
}

function setQueryParams(params, skipNulls) {
	if ( skipNulls === void 0 ) skipNulls = true;

	if (typeof window !== 'undefined') {
		var ref = window.location;
		var protocol = ref.protocol;
		var host = ref.host;
		var pathname = ref.pathname;
		var newUrl = protocol + "//" + host + pathname + (qs.stringify(params, {
			skipNulls: skipNulls,
			arrayFormat: 'repeat',
			addQueryPrefix: true,
		}));

		window.history.replaceState('', '', ("" + newUrl));
	}
}

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
				filters: null,
				parameters: this.parameters,
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
				},
				// previous: null,
			},
			config: Object.assign(
				{},
				defaultOptions,
				this.options
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
		requestQuery: function requestQuery() {
			var nonUrlQuery = Object.assign({},
				this.queryParts.parameters,
				this.queryParts.limit
			);

			if (this.states.hasFetchedOnce) {
				return nonUrlQuery;
			}

			var urlQuery = getQueryParams();

			return !urlQuery
				? nonUrlQuery
				: Object.assign({},
					urlQuery,
					this.queryParts.pagination.limit
				);
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
		forceFetchFromOffsetZero: function forceFetchFromOffsetZero() {
			return this.config.listType === 'more' && this.requestQuery.offset > 0;
		},
	},
	watch: {
		'queryParts.parameters': {
			handler: function handler() {
				console.log('QP parameters');
				this.requestHub('new');
			},
			deep: true,
		},
		'queryParts.filters': {
			handler: function handler() {
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
	mounted: function mounted() {
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
					}
				));
		}
	},
	methods: {
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
			console.log('Changed request, motherfucker');
			if (this.enableLiveSearch && this.validQuery) {
				this.states.loading = true;
				this.debounce({ cb: this.request, args: [type] });
			} else if (!this.validQuery) {
				// Clear request params from url
				this.updateUrlParams({});
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
					var notFirstFetch = total !== null;
					var totalChanged = total !== result.pagination.total;
					var notNewRequest = type !== 'new';

					if (notFirstFetch && notNewRequest && totalChanged) {
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

			// Update url with request params
			this.updateUrlParams(params);

			return new Promise(function (resolve, reject) {
				axios({
					url: this$1.config.api,
					method: 'GET',
					params: this$1.transformParams(params),
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
		updateFilters: function updateFilters(filters) {
			if (filters && filters.length) {
				this.$set(this.data, 'filters', filters);
			}
		},
		updateUrlParams: function updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams: function updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);

			// Always fetch with the configured limit.
			this.requestQuery.limit = this.config.limit;
			this.requestQuery.offset = pagination.offset;
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:['sky-list', { loading : _vm.states.loading }]},[_vm._t("default",null,{query:{
			parameters: _vm.queryParts.parameters,
			filters: _vm.queryParts.filters,
		},result:_vm.data.items,filters:_vm.data.filters,states:_vm.states,pagination:_vm.data.pagination,fetch:_vm.more})],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = undefined;
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

export default install;
export { SkyList };
