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
			default: function (query) { return query.keywords; },
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
		itemsLeft: function itemsLeft() {
			// Provides the amount of items not displayed yet.
			var ref = this.result.pagination;
			var limit = ref.limit;
			var offset = ref.offset;
			var total = ref.total;

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
		currentResultSet: function currentResultSet() {
			// Showing the part of the complete resultset currently wanted.
			var ref = this.result;
			var data = ref.data;

			return data;
		},
		limitEnd: function limitEnd() {
			return this.result.pagination.offset + this.result.pagination.limit;
		},
		canFetchMore: function canFetchMore() {
			return this.limitEnd < this.result.pagination.total;
		},
		queryFlatArrays: function queryFlatArrays() {
			var this$1 = this;

			// We loop through the query and join all arrays to strings
			var res = {};
			var extractObjectKey = Object.keys(this.valueMap);

			Object.keys(this.query).forEach(function (key) {
				if (Array.isArray(this$1.query[key])) {
					res[key] = this$1.query[key]
						.map(function (queryProperty) {
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
						? this$1.query[key]
						: this$1.query[key][this$1.valueMap[key]];
				}
			});
			return res;
		},
		validQuery: function validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.query)
				: this.validateQuery;
		},
		requestParams: function requestParams() {
			var rp = Object.assign({}, this.queryFlatArrays, {
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
	mounted: function mounted() {
		// Do fetch on mount, if configured to or if initiated with valid query from url params
		if (this.config.immediate || this.validQuery) {
			this.request();
		}
	},
	methods: {
		more: function more(all) {

		},
		request: function request(type) {
			var this$1 = this;
			if ( type === void 0 ) type = 'clean';

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
						this$1.fetch(Object.assign({}, this$1.requestParams, {
							limit: this$1.limitEnd, // hvorfor limit = limitEnd?
							offset: 0,
						})).then(function (secondaryResult) {
							this$1.$set(this$1.result, 'data', result.data);
						});
					} else {
						this$1.$set(this$1.result, 'data', result.data);
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
			if ( params === void 0 ) params = this.requestParams;

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
		updateUrlParams: function updateUrlParams(params) {
			setQueryParams(params);
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:['sky-list', { loading : _vm.states.loading }]},[_vm._t("default",[_c('div',{staticClass:"sky-list-form"},[_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.listQuery.keywords),expression:"listQuery.keywords"}],attrs:{"type":"text"},domProps:{"value":(_vm.listQuery.keywords)},on:{"input":function($event){if($event.target.composing){ return; }_vm.$set(_vm.listQuery, "keywords", $event.target.value);}}})]),_vm._v(" "),((_vm.validQuery || _vm.config.immediate))?_c('div',{staticClass:"sky-list-content"},[(_vm.config.showCount && _vm.states.hasFetchedOnce && (_vm.currentResultSet.length > 0))?_c('div',{staticClass:"sky-list-message"},[_c('span',[_vm._v("\n\t\t\t\t\tYour search for "),_c('em',[_vm._v("\""+_vm._s(_vm.listQuery.keywords)+"\"")]),_vm._v(" returned "),_c('em',[_vm._v(_vm._s(_vm.result.pagination.total)+" "+_vm._s((_vm.result.pagination.total === 1) ? 'result' : 'results'))])])]):_vm._e(),_vm._v(" "),(_vm.currentResultSet.length > 0)?_c('div',{staticClass:"sky-list-result"},[_c('ul',_vm._l((_vm.currentResultSet),function(item,index){return _c('li',{key:item.id,staticClass:"sky-list-item"},[_c('span',{domProps:{"textContent":_vm._s(("Result item with ID: " + (item.id)))}})])}))]):(_vm.states.hasFetchedOnce)?_c('div',{staticClass:"sky-list-result empty"},[_c('span',{domProps:{"textContent":_vm._s('Your search returned no results')}})]):_vm._e(),_vm._v(" "),_c('div',{class:_vm.sky-_vm.list-_vm.pagination},[_c('button',{staticClass:"sky-list-more",on:{"click":function($event){_vm.more(true);}}},[_c('span',{domProps:{"textContent":_vm._s("Show All")}})])])]):_vm._e()],{query:_vm.listQuery,result:_vm.currentResultSet,areas:_vm.result.groups,states:_vm.states,pagination:_vm.result.pagination,fetch:_vm.more,newRequest:_vm.handleUserSearch,nativeSearchHandler:_vm.nativeSearchHandling})],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = "data-v-42393e22";
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
