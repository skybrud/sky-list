'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var axios = _interopDefault(require('axios'));
var qs = _interopDefault(require('qs'));

// import debounce from 'debounce';

var defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
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
		var baseUrl = (window.location.protocol) + "//" + (window.location.host) + (window.location.pathname);
		var qString = qs.stringify(params, { skipNulls: skipNulls });
		var q = qString ? ("?" + qString) : '';
		window.history.replaceState('', '', ("" + baseUrl + q));
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
			previousQuery: {},
			query: Object.assign(
				{},
				this.parameters,
				getQueryParams() // initiate with query params from url
			),
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
	mounted: function mounted() {
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		this.request();
	},
	methods: {
		more: function more(all) {
			var ref = this.result.pagination;
			var limit = ref.limit;
			var total = ref.total;
			var offset = ref.offset;
			var newPagination = { offset: offset + limit };

			if (all) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.request('append');
		},
		request: function request(type) {
			var this$1 = this;
			if ( type === void 0 ) type = 'initial';

			this.states.loading = true;
			var ref = this.result.pagination;
			var total = ref.total;
			var offset = ref.offset;

			this.fetch()
				.then(function (result) {
					var firstFetch = total === null || offset === 0;
					var totalChanged = total !== result.pagination.total;
					var filterNotRequested = type !== 'filter';

					if (!firstFetch && totalChanged && filterNotRequested) {
						// if total has changed refetch entire list and replace
						console.log('refetch initiated');
						this$1.fetch(Object.assign({}, this$1.query, {
							limit: this$1.limitEnd, // hvorfor limit = limitEnd?
							offset: 0,
						})).then(function (secondaryResult) {
							this$1.setData(secondaryResult);
						});
					} else {
						this$1.setData(result);
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
			if ( params === void 0 ) params = this.query;

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
		setData: function setData(result) {
			var pagination = result.pagination;
			var data = result.data;
			var filters = result.filters;

			this.$set(this.result, 'data', data);

			this.updatePaginationParams(pagination);
		},
		updateUrlParams: function updateUrlParams(params) {
			setQueryParams(params);
		},
		updatePaginationParams: function updatePaginationParams(pagination) {
			this.$set(this.result, 'pagination', pagination);
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:['sky-list', { loading : _vm.states.loading }]},[_vm._t("default",[((_vm.validQuery || _vm.config.immediate))?_c('div',{staticClass:"sky-list-content"},[(_vm.config.showCount && _vm.states.hasFetchedOnce && (_vm.result.data.length > 0))?_c('div',{staticClass:"sky-list-message"},[_c('span')]):_vm._e(),_vm._v(" "),(_vm.result.data.length > 0)?_c('div',{staticClass:"sky-list-result"},[_c('ul',_vm._l((_vm.result.data),function(item,index){return _c('li',{key:item.id,staticClass:"sky-list-item"},[_c('span',{domProps:{"textContent":_vm._s(("Result item with ID: " + (item.id)))}})])}))]):(_vm.states.hasFetchedOnce)?_c('div',{staticClass:"sky-list-result empty"},[_c('span',{domProps:{"textContent":_vm._s('Your search returned no results')}})]):_vm._e(),_vm._v(" "),_c('div',{class:_vm.sky-_vm.list-_vm.pagination},[_c('button',{staticClass:"sky-list-more",on:{"click":function($event){_vm.more(true);}}},[_c('span',{domProps:{"textContent":_vm._s("Show All")}})])])]):_vm._e()],{query:_vm.query,result:_vm.result.data,states:_vm.states,pagination:_vm.result.pagination,fetch:_vm.more})],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = "data-v-60b79aa2";
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
