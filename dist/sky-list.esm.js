import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

var defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	immediate: false,
	listType: 'more',
	liveSearch: true,
	omitInUrl: [],
};

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
			default: function () { return true; },
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
			query: {
				facets: {},
				parameters: this.parameters,
				pagination: {
					limit: this.options.limit || defaultOptions.limit,
					offset: 0,
				},
			},
			data: {
				items: [],
				facets: [],
				pagination: {
					limit: null,
					offset: null,
					total: null,
				},
				meta: null,
				misc: null,
			},
			states: {
				hasFetchedOnce: false,
				cancelToken: null,
				loading: false,
			},
			config: Object.assign(
				{},
				defaultOptions,
				this.options
			),
		};
	},
	watch: {
		'query.parameters': {
			handler: function handler() {
				if (this.liveSearchEnabled) {
					this.requestGate();
				}
			},
			deep: true,
		},
		'states.loading': {
			handler: function handler(value) {
				this.$emit('isLoading', value);
			},
		},
	},
	computed: {
		validQuery: function validQuery() {
			return (typeof this.validateQuery === 'function')
				? !!this.validateQuery(this.requestQuery)
				: !!this.validateQuery;
		},
		liveSearchEnabled: function liveSearchEnabled() {
			return this.config.immediate
				? this.config.liveSearch && this.states.hasFetchedOnce
				: this.config.liveSearch;
		},
		requestQuery: function requestQuery() {
			return Object.assign({},
				this.query.parameters,
				this.query.facets,
				this.query.pagination
			);
		},
		urlQueryString: function urlQueryString() {
			return this.removeUrlParts(
				this.objectToQueryString({ params: this.requestQuery }),
				this.config.omitInUrl
			);
		},
	},
	beforeMount: function beforeMount() {
		var this$1 = this;

		var urlObject = this.getQueryParams();
		var urlObjectKeyArray = Object.keys(urlObject);

		urlObjectKeyArray.forEach(function (key) {
			if (this$1.query.parameters[key] !== undefined) {
				this$1.query.parameters[key] = urlObject[key];
			} else if (this$1.query.pagination[key] !== undefined) {
				this$1.query.pagination[key] = urlObject[key] * 1;
			} else {
				this$1.query.facets[key] = Array.isArray(urlObject[key])
					? urlObject[key]
					: [urlObject[key]];
			}

			if (!this$1.config.immediate) {
				this$1.config.immediate = true;
			}
		});
	},
	mounted: function mounted() {
		var this$1 = this;

		if (this.config.immediate) {
			var shouldPrepend = this.query.pagination.offset
				&& (this.config.listType === 'more'
				|| this.config.listType === 'all');

			if (shouldPrepend) {
				var ref = this.query.pagination;
				var offset = ref.offset;
				var limit = ref.limit;
				this.query.pagination.limit = offset + limit;
				this.query.pagination.offset = 0;
			}

			this.request({ params: this.requestQuery })
				.then(function () {
					if (shouldPrepend) {
						var ref = this$1.query.pagination;
						var limit = ref.limit;

						this$1.query.pagination.offset = limit - this$1.config.limit;
						this$1.query.pagination.limit = this$1.config.limit;
						this$1.data.pagination.offset = limit - this$1.config.limit;
						this$1.data.pagination.limit = this$1.config.limit;

						this$1.setUrlQuery(this$1.urlQueryString);
					}
				});
		}
	},
	methods: {
		debounce: debounce(function (ref) {
			var cb = ref.cb;
			var args = ref.args;

			cb(args);
		}, 500),
		requestGate: function requestGate(ref) {
			if ( ref === void 0 ) ref = {};
			var type = ref.type; if ( type === void 0 ) type = 'new';
			var params = ref.params; if ( params === void 0 ) params = this.requestQuery;

			if (this.validQuery) {
				this.debounce({ cb: this.request, args: { params: params, type: type } });
			} else {
				this.resetQueryAndData();
				this.setUrlQuery('');
			}
		},
		resetPagination: function resetPagination() {
			this.updatePaginationParams({
				limit: this.config.limit,
				offset: 0,
				total: this.data.total,
			});
		},
		resetQueryAndData: function resetQueryAndData() {
			var this$1 = this;

			Object.keys(this.query.facets).forEach(function (key) {
				this$1.query.facets[key].splice(0);
			});

			this.query.pagination.limit = this.config.limit;
			this.query.pagination.offset = 0;

			this.data.items.splice(0);

			this.data.pagination.limit = null;
			this.data.pagination.offset = null;
			this.data.pagination.total = null;
		},
		all: function all() {
			this.more(true);
		},
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

			if (all === true) {
				newPagination.limit = total - offset;
			}

			this.updatePaginationParams(newPagination);

			this.requestGate({ type: 'append' });
		},
		setValue: function setValue(key, value, queryPart) {
			if ( queryPart === void 0 ) queryPart = 'facets';

			this.$set(this.query[queryPart], key, value);
		},
		toggleValue: function toggleValue(key, value, queryPart) {
			if ( queryPart === void 0 ) queryPart = 'facets';

			var tempArray = [].concat( this.query[queryPart][key] );
			var valueIndex = tempArray.indexOf(("" + value));

			valueIndex === -1
				? tempArray.push(("" + value))
				: tempArray.splice(valueIndex, 1);

			this.$set(this.query[queryPart], key, tempArray);

			if (this.liveSearchEnabled) {
				this.requestGate();
			}
		},
		removeUrlParts: function removeUrlParts(target, unwantedParameters) {
			var wantedParts = target
				.substring(1)
				.split('&')
				.filter(function (part) { return unwantedParameters.indexOf(part.split('=')[0]) === -1; });

			return ("?" + (wantedParts.join('&')));
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
		request: function request(ref) {
			var this$1 = this;
			if ( ref === void 0 ) ref = {};
			var params = ref.params; if ( params === void 0 ) params = this.requestQuery;
			var type = ref.type; if ( type === void 0 ) type = 'new';

			this.states.loading = true;
			var ref$1 = this.data.pagination;
			var total = ref$1.total;

			return this.fetch(params)
				.then(function (result) {
					var notNewRequest = type !== 'new';
					var totalChanged = total !== result.pagination.total;
					var initiateNewFetch = notNewRequest && totalChanged;

					if (initiateNewFetch) {
						// if total has changed refetch entire list and replace
						console.log('[SkyList]: refetch initiated');
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

			this.setUrlQuery(this.urlQueryString);

			var transformedParams = this.transformParams(params);

			return new Promise(function (resolve, reject) {
				axios({
					url: this$1.config.api,
					method: 'GET',
					params: transformedParams,
					paramsSerializer: function (transformedParameters) { return this$1.objectToQueryString({
						params: transformedParameters,
						addQueryPrefix: false,
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
			var facets = result.facets;
			var misc = result.misc;
			var meta = result.meta;

			switch (type) {
			case 'append':
				this.$set(this.data, 'items', this.data.items.concat( data));
				break;

			default:
				this.$set(this.data, 'items', data);
				this.updateFacets(facets);
				break;
			}

			this.updatePaginationParams(pagination);

			this.updateMisc(misc);
			this.updateMeta(meta);

			this.states.loading = false;
		},
		getQueryParams: function getQueryParams() {
			if (typeof window !== 'undefined') {
				var q = window.location.search.replace('?', '');
				return qs.parse(q);
			}

			return {};
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
		updateFacets: function updateFacets(facets) {
			if (facets) {
				this.$set(this.data, 'facets', facets);

				this.$set(this.query, 'facets', Object.assign({},
					facets.reduce(function (acc, cur) {
						acc[cur.alias] = [];

						return acc;
					}, {}),
					this.query.facets
				));
			}
		},
		updatePaginationParams: function updatePaginationParams(pagination) {
			this.$set(this.data, 'pagination', pagination);
			this.$set(this.query, 'pagination', {
				limit: pagination.limit,
				offset: pagination.offset,
			});
		},
		updateMeta: function updateMeta(meta) {
			this.$set(this.data, 'meta', meta);
		},
		updateMisc: function updateMisc(misc) {
			this.$set(this.data, 'misc', misc);
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:[
	'sky-list',
	{ 'sky-list--loading' : _vm.states.loading } ]},[_vm._t("default",null,{query:{
			parameters: _vm.query.parameters,
			facets: _vm.query.facets,
		},data:{
			misc: _vm.data.misc,
			meta: _vm.data.meta,
			items: _vm.data.items,
			pagination: _vm.data.pagination,
			facets: _vm.data.facets,
		},states:_vm.states,action:{
			toggleValue: _vm.toggleValue,
			setValue: _vm.setValue,
		},resets:{
			pagination: _vm.resetPagination,
		},request:{
			submit: _vm.request,
			more: _vm.more,
			all: _vm.all,
		}})],2)};
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
