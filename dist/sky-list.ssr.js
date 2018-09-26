'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var axios = _interopDefault(require('axios'));
var qs = _interopDefault(require('qs'));
var debounce = _interopDefault(require('debounce'));

const defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	showCount: false,
	filterType: 'request',
	paginationType: 'more', // navigation | pagination | more | all | numeric
	loadFetch: false,
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

var script = {
	name: 'SkyList',
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
			default: () => ({ keywords: '' }),
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
				this.states.loading = true;
				this.updateListQuery();
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
		'states.loading': function(value) {
			if (value) {
				this.$emit('loadingBegin');
			} else {
				this.$emit('loadingEnd');
			}
		},
		result: {
			handler(value) {
				this.$emit('result', value);
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
		updateListQuery: debounce(function() {
			this.$set(this, 'listQuery', Object.assign({}, this.filter, this.parameters, this.query));
		}, 200),
		// This method runs on liveSearch = true, so we make sure to debounce it by 100ms
		// so we don't spam the server needlessly
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

			// add any unknown custom result props to result object, since we only
			// handle data, pagination and areas above
			Object.keys(result)
				.filter((key) => {
					return key !== 'data' && key !== 'pagination' && key !== 'areas';
				})
				.forEach((key) => {
					this.result[key] = result[key];
				});

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
			setQueryParams(params);
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

/* script */
            const __vue_script__ = script;
            
/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{class:['sky-list', { loading : _vm.states.loading }]},[(_vm.$scopedSlots.listForm)?_vm._ssrNode("<div class=\"sky-list-form\">","</div>",[_vm._t("listForm",null,{query:_vm.listQuery,result:_vm.result,newRequest:_vm.handleUserSearch,nativeSearchHandler:_vm.nativeSearchHandling})],2):_vm._e(),_vm._ssrNode(" "),((_vm.validQuery || _vm.config.loadFetch)
			&& (_vm.filterKeys.length > 0)
			&& _vm.states.hasFetchedOnce
			&& _vm.$scopedSlots.filters)?_vm._ssrNode("<div class=\"sky-list-filter\">","</div>",[_vm._t("filters",null,{query:_vm.listQuery,result:_vm.result,areas:_vm.result.groups})],2):_vm._e(),_vm._ssrNode(" "),((_vm.validQuery || _vm.config.loadFetch))?_vm._ssrNode("<div class=\"sky-list-content\">","</div>",[(_vm.config.showCount && _vm.states.hasFetchedOnce)?_vm._ssrNode("<div class=\"sky-list-message\">","</div>",[(_vm.currentResultSet.length > 0)?_vm._t("resultMessage",[_c('span',[_vm._v("\n\t\t\t\t\tYour search for "),_c('em',[_vm._v("\""+_vm._s(_vm.listQuery.keywords)+"\"")]),_vm._v(" returned "),_c('em',[_vm._v(_vm._s(_vm.result.pagination.total)+" "+_vm._s((_vm.result.pagination.total === 1) ? 'result' : 'results'))])])],{query:_vm.listQuery,pagination:_vm.result.pagination}):_vm._e()],2):_vm._e(),_vm._ssrNode(" "),(_vm.currentResultSet.length > 0)?_vm._ssrNode("<div class=\"sky-list-result\">","</div>",[_vm._ssrNode("<ul>","</ul>",_vm._l((_vm.currentResultSet),function(item,index){return _vm._ssrNode("<li class=\"sky-list-item\">","</li>",[_vm._t("listItem",null,{item:item,index:index})],2)})),_vm._ssrNode(" "),(_vm.$scopedSlots.listAside)?_vm._ssrNode("<div class=\"sky-list-aside\">","</div>",[_vm._t("listAside",null,{query:_vm.listQuery,result:_vm.result})],2):_vm._e()],2):(_vm.states.hasFetchedOnce)?_vm._ssrNode("<div class=\"sky-list-result empty\">","</div>",[_vm._t("noResultMessage",[_c('span',{domProps:{"textContent":_vm._s('Your search returned no results')}})],{query:_vm.listQuery})],2):_vm._e(),_vm._ssrNode(" "),(_vm.showPagination)?_vm._ssrNode("<div"+(_vm._ssrClass(null,['sky-list-pagination', ("type-" + (_vm.config.paginationType))]))+">","</div>",[(_vm.morePagination)?_vm._ssrNode("<button class=\"sky-list-more\">","</button>",[_vm._t("listMore",[_c('span',{domProps:{"textContent":_vm._s(("Show " + (_vm.config.paginationType)))}})],{itemsLeft:_vm.itemsLeft})],2):_vm._e(),_vm._ssrNode(" "),(_vm.numericPagination)?_vm._ssrNode("<ul class=\"sky-list-numeric\">","</ul>",_vm._l((_vm.pages.max),function(n){return _vm._ssrNode("<li"+(_vm._ssrClass(null,{ current: _vm.pages.current === n }))+">","</li>",[_vm._ssrNode("<button>","</button>",[_vm._t("paginationBullet",[_c('span',{domProps:{"textContent":_vm._s(n)}})],{count:n})],2)])})):_vm._e(),_vm._ssrNode(" "),(_vm.flowPagination)?_vm._ssrNode("<button class=\"sky-list-previous\">","</button>",[_vm._t("listPrev",[_c('span',[_vm._v("Previous")])])],2):_vm._e(),_vm._ssrNode(" "),(_vm.flowPagination)?_vm._ssrNode("<button class=\"sky-list-next\">","</button>",[_vm._t("listNext",[_c('span',[_vm._v("Next")])])],2):_vm._e()],2):_vm._e()],2):_vm._e()],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  const __vue_inject_styles__ = function (inject) {
    if (!inject) return
    inject("data-v-ed180d66_0", { source: "\n.sky-list .sky-reveal{min-height:0\n}\n.sky-list-content{width:100%;text-align:center\n}\n.sky-list-message{text-align:left\n}\n.sky-list-result{position:relative;transition:opacity .2s 0s;text-align:left;transition-delay:.3s\n}\nul{display:flex\n}\n.loading &{pointer-events:none\n}", map: undefined, media: undefined });

  };
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = "data-v-ed180d66";
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* component normalizer */
  function __vue_normalize__(
    template, style, script$$1,
    scope, functional, moduleIdentifier,
    createInjector, createInjectorSSR
  ) {
    const component = (typeof script$$1 === 'function' ? script$$1.options : script$$1) || {};

    // For security concerns, we use only base name in production mode.
    component.__file = "SkyList.vue";

    if (!component.render) {
      component.render = template.render;
      component.staticRenderFns = template.staticRenderFns;
      component._compiled = true;

      if (functional) component.functional = true;
    }

    component._scopeId = scope;

    {
      let hook;
      {
        // In SSR.
        hook = function(context) {
          // 2.3 injection
          context =
            context || // cached call
            (this.$vnode && this.$vnode.ssrContext) || // stateful
            (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
          // 2.2 with runInNewContext: true
          if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
            context = __VUE_SSR_CONTEXT__;
          }
          // inject component styles
          if (style) {
            style.call(this, createInjectorSSR(context));
          }
          // register component module identifier for async chunk inference
          if (context && context._registeredComponents) {
            context._registeredComponents.add(moduleIdentifier);
          }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        component._ssrRegister = hook;
      }

      if (hook !== undefined) {
        if (component.functional) {
          // register for functional component in vue file
          const originalRender = component.render;
          component.render = function renderWithStyleInjection(h, context) {
            hook.call(context);
            return originalRender(h, context)
          };
        } else {
          // inject component registration as beforeCreate hook
          const existing = component.beforeCreate;
          component.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
      }
    }

    return component
  }
  /* style inject */
  
  /* style inject SSR */
  function __vue_create_injector_ssr__(context) {
    if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
      context = __VUE_SSR_CONTEXT__;
    }

    if (!context) return function () {}

    if (!context.hasOwnProperty('styles')) {
      Object.defineProperty(context, 'styles', {
        enumerable: true,
        get: () => context._styles
      });
      context._renderStyles = renderStyles;
    }

    function renderStyles(styles) {
      let css = '';
      for (const {ids, media, parts} of styles) {
        css +=
          '<style data-vue-ssr-id="' + ids.join(' ') + '"' + (media ? ' media="' + media + '"' : '') + '>'
          + parts.join('\n') +
          '</style>';
      }

      return css
    }

    return function addStyle(id, css) {
      const group = css.media || 'default';
      const style = context._styles[group] || (context._styles[group] = { ids: [], parts: [] });

      if (!style.ids.includes(id)) {
        style.media = css.media;
        style.ids.push(id);
        let code = css.source;
        style.parts.push(code);
      }
    }
  }

  
  var SkyList = __vue_normalize__(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    __vue_create_injector_ssr__
  );

const defaults = {
	registerComponents: true,
};

function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	const { registerComponents } = Object.assign({}, defaults, options);

	if (registerComponents) {
		Vue.component(SkyList.name, SkyList);
	}
}

exports.SkyList = SkyList;
exports.default = install;
