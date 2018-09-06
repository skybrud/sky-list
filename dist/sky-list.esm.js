import axios from 'axios';
import qs from 'qs';
import debounce from 'debounce';

var defaultOptions = {
	api: '/umbraco/api/site/search/',
	limit: 10,
	showCount: false,
	filterType: 'request',
	paginationType: 'more', // navigation | pagination | more | all | numeric
	loadFetch: false,
};

function getQueryParams() {
	if (typeof window !== 'undefined') {
		var q = window.location.search.replace('?', '');
		return qs.parse(q);
	}
	return {};
}

function setQueryParams(params) {
	if (typeof window !== 'undefined') {
		var baseUrl = (window.location.protocol) + "//" + (window.location.host) + (window.location.pathname);
		var qString = qs.stringify(params);
		var q = qString ? ("?" + qString) : '';
		window.history.replaceState('', '', ("" + baseUrl + q));
	}
}

var script = {
	name: 'SkyList',
	props: {
		// override query with external values
		query: {
			type: Object,
			default: function () { return ({}); },
		},
		// Value map is used for fetching vue-multiselect value
		valueMap: {
			type: Object,
			default: function () { return ({}); },
		},
		filter: {
			type: Object,
			default: function () { return ({}); },
		},
		parameters: {
			type: Object,
			default: function () { return ({
				keywords: '',
			}); },
		},
		options: {
			type: Object,
			default: function () { return ({}); },
		},
		validateQuery: {
			type: Function,
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
		numericPagination: function numericPagination() {
			return (this.config.paginationType === 'numeric') || (this.config.paginationType === 'pagination');
		},
		flowPagination: function flowPagination() {
			return (this.config.paginationType === 'navigation') || (this.config.paginationType === 'pagination');
		},
		morePagination: function morePagination() {
			return (this.config.paginationType === 'more') || (this.config.paginationType === 'all');
		},
		showPagination: function showPagination() {
			if (!this.states.hasFetchedOnce) {
				return false;
			}
			if (this.morePagination) {
				return this.canFetchMore;
			}
			return this.pages.max > 1;
		},
		filterKeys: function filterKeys() {
			return Object.keys(this.filter);
		},
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
		resultStartIndex: function resultStartIndex() {
			if (this.morePagination) {
				return 0;
			}

			return (this.pages.current - 1) * this.config.limit;
		},
		resultEndIndex: function resultEndIndex() {
			var ref = this.result;
			var ref_pagination = ref.pagination;
			var offset = ref_pagination.offset;
			var limit = ref_pagination.limit;
			var total = ref_pagination.total;
			if (total === null) {
				return offset + limit;
			}

			return Math.min(offset + limit, total);
		},
		currentResultSet: function currentResultSet() {
			// Showing the part of the complete resultset currently wanted.
			var ref = this.result;
			var data = ref.data;

			return data[this.pageNoToIndex(this.getCurrentPage())] || [];
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

			Object.keys(this.listQuery).forEach(function (key) {
				if (Array.isArray(this$1.listQuery[key])) {
					res[key] = this$1.listQuery[key]
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
						? this$1.listQuery[key]
						: this$1.listQuery[key][this$1.valueMap[key]];
				}
			});
			return res;
		},
		validQuery: function validQuery() {
			return (typeof this.validateQuery === 'function')
				? this.validateQuery(this.listQuery)
				: this.validateQuery;
		},
		requestParams: function requestParams() {
			return Object.assign({}, {
				limit: this.result.pagination.limit,
				offset: this.result.pagination.offset,
			},
			this.queryFlatArrays);
		},
	},
	watch: {
		query: {
			handler: function handler() {
				this.states.loading = true;
				this.updateListQuery();
			},
			deep: true,
		},
		listQuery: {
			handler: function handler() {
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
	mounted: function mounted() {
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
		handleUserSearch: function handleUserSearch() {
			var this$1 = this;

			if (this.validQuery) {
				Object.keys(this.listQuery).forEach(function (key) {
					var changedKey = this$1.listQuery[key] !== this$1.previousQuery[key];
					var isFilterKey = this$1.filterKeys.includes(key);

					if (changedKey && isFilterKey) {
						this$1.filterData();
					} else if (changedKey) {
						this$1.request();
					}

					if (changedKey) {
						Object.assign(this$1.previousQuery, this$1.listQuery);
					}
				});
			} else {
				this.resetPagination();
			}
		},
		nativeSearchHandling: function nativeSearchHandling() {
			this.validQuery
				// Handle pressing enter
				? this.request()
				// Handle clearing input
				: this.resetPagination();
		},
		setCurrentPage: function setCurrentPage(pageNo) {
			this.pages.current = pageNo;
		},
		getCurrentPage: function getCurrentPage() {
			return this.pages.current;
		},
		pageNoToIndex: function pageNoToIndex(value) {
			return value ? --value : 0;
		},
		requestedPageIsFetched: function requestedPageIsFetched(pageNoRequested) {
			var ref = this.result;
			var data = ref.data;

			return data[pageNoRequested - 1];
		},
		filterData: function filterData() {
			var this$1 = this;

			var ref = this.result;
			var groups = ref.groups;
			var total = ref.pagination.total;

			var currentArea = groups
				? groups.find(function (area) { return area.id === this$1.listQuery.area; })
				: null;
			var currentAreaCount = (currentArea && currentArea.count)
				? currentArea.count
				: total;

			this.setCurrentPage(1);
			this.setPagination({ offset: 0, total: currentAreaCount });

			this.request('filter');
		},
		more: function more(all) {
			var ref = this.result.pagination;
			var limit = ref.limit;
			var total = ref.total;
			var offset = ref.offset;
			var newPagination = { offset: offset + limit };

			if (all) {
				newPagination.limit = total - offset;
			}

			this.setPagination(newPagination);

			this.request('append');
		},
		goTo: function goTo(target) {
			var ref = this.result.pagination;
			var limit = ref.limit;
			var offset = ref.offset;

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
		request: function request(type, pageNo) {
			var this$1 = this;
			if ( type === void 0 ) type = 'clean';
			if ( pageNo === void 0 ) pageNo = 1;

			this.states.loading = true;
			var ref = this.result.pagination;
			var total = ref.total;
			var offset = ref.offset;

			if (!this.states.hasFetchedOnce) {
				this.states.hasFetchedOnce = true;
			}

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
							this$1.dataParser(secondaryResult, type, pageNo);
						});
					} else {
						this$1.dataParser(result, type, pageNo);
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
		dataParser: function dataParser(result, type, pageNo) {
			var this$1 = this;
			if ( type === void 0 ) type = 'clean';

			var data = result.data;
			var pagination = result.pagination;
			var areas = result.areas;

			this.pages.max = Math.ceil(pagination.total / pagination.limit);

			var dataActions = {
				append: function () {
					// Append fetched result to existing.
					this$1.setResultData(this$1.result.data[0].concat( data));
				},
				page: function () {
					this$1.setResultData(data, this$1.pageNoToIndex(pageNo));
				},
				clean: function () {
					// Reset result object to newly fetched result.
					this$1.setResultData(data, this$1.pageNoToIndex(pageNo));
					this$1.setPagination({ offset: 0, total: pagination.total });
					this$1.setGroups(areas);
				},
				filter: function () {
					// Resets all, but group info and query
					this$1.deleteResultData();

					this$1.setResultData(data, this$1.pageNoToIndex(pageNo));
				},
			};

			dataActions[type]();

			// add any unknown custom result props to result object, since we only
			// handle data, pagination and areas above
			Object.keys(result)
				.filter(function (key) {
					return key !== 'data' && key !== 'pagination' && key !== 'areas';
				})
				.forEach(function (key) {
					this$1.result[key] = result[key];
				});

			this.states.loading = false;
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
		resetQuery: function resetQuery() {
			var this$1 = this;

			this.filterKeys.forEach(function (param) {
				this$1.listQuery[param] = this$1.filter[param];
			});

			this.resetPagination();
		},
		resetPagination: function resetPagination() {
			this.setPagination({ offset: 0, total: 0 });
		},
		setGroups: function setGroups(groups) {
			this.$set(this.result, 'groups', groups);
		},
		setPagination: function setPagination(pagination) {
			this.$set(this.result, 'pagination', Object.assign(this.result.pagination, pagination));
		},
		setResultData: function setResultData(data, index) {
			var this$1 = this;
			if ( index === void 0 ) index = 0;

			for (var i = 0; i < index; i++) {
				if (!this$1.result.data[i]) {
					this$1.result.data.splice(i, 1, null);
				}
			}

			this.result.data.splice(index, 1, data);
		},
		deleteResultData: function deleteResultData() {
			this.result.data.splice(0);
		},
	},
};

/* script */
            var __vue_script__ = script;
/* template */
var __vue_render__ = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c("div", { class: ["sky-list", { loading: _vm.states.loading }] }, [
    _vm.$scopedSlots.listForm
      ? _c(
          "div",
          { staticClass: "sky-list-form" },
          [
            _vm._t("listForm", null, {
              query: _vm.listQuery,
              result: _vm.result,
              newRequest: _vm.handleUserSearch,
              nativeSearchHandler: _vm.nativeSearchHandling
            })
          ],
          2
        )
      : _vm._e(),
    _vm._v(" "),
    (_vm.validQuery || _vm.config.loadFetch) &&
    _vm.filterKeys.length > 0 &&
    _vm.states.hasFetchedOnce &&
    _vm.$scopedSlots.filters
      ? _c(
          "div",
          { staticClass: "sky-list-filter" },
          [
            _vm._t("filters", null, {
              query: _vm.listQuery,
              result: _vm.result,
              areas: _vm.result.groups
            })
          ],
          2
        )
      : _vm._e(),
    _vm._v(" "),
    _vm.validQuery || _vm.config.loadFetch
      ? _c("div", { staticClass: "sky-list-content" }, [
          _vm.config.showCount && _vm.states.hasFetchedOnce
            ? _c(
                "div",
                { staticClass: "sky-list-message" },
                [
                  _vm.currentResultSet.length > 0
                    ? _vm._t(
                        "resultMessage",
                        [
                          _c("span", [
                            _vm._v("\n\t\t\t\t\tYour search for "),
                            _c("em", [
                              _vm._v('"' + _vm._s(_vm.listQuery.keywords) + '"')
                            ]),
                            _vm._v(" returned "),
                            _c("em", [
                              _vm._v(
                                _vm._s(_vm.result.pagination.total) +
                                  " " +
                                  _vm._s(
                                    _vm.result.pagination.total === 1
                                      ? "result"
                                      : "results"
                                  )
                              )
                            ])
                          ])
                        ],
                        {
                          query: _vm.listQuery,
                          pagination: _vm.result.pagination
                        }
                      )
                    : _vm._e()
                ],
                2
              )
            : _vm._e(),
          _vm._v(" "),
          _vm.currentResultSet.length > 0
            ? _c("div", { staticClass: "sky-list-result" }, [
                _c(
                  "ul",
                  _vm._l(_vm.currentResultSet, function(item, index) {
                    return _c(
                      "li",
                      { key: item.id, staticClass: "sky-list-item" },
                      [_vm._t("listItem", null, { item: item, index: index })],
                      2
                    )
                  })
                ),
                _vm._v(" "),
                _vm.$scopedSlots.listAside
                  ? _c(
                      "div",
                      { staticClass: "sky-list-aside" },
                      [
                        _vm._t("listAside", null, {
                          query: _vm.listQuery,
                          result: _vm.result
                        })
                      ],
                      2
                    )
                  : _vm._e()
              ])
            : _vm.states.hasFetchedOnce
              ? _c(
                  "div",
                  { staticClass: "sky-list-result empty" },
                  [
                    _vm._t(
                      "noResultMessage",
                      [
                        _c("span", {
                          domProps: {
                            textContent: _vm._s(
                              "Your search returned no results"
                            )
                          }
                        })
                      ],
                      { query: _vm.listQuery }
                    )
                  ],
                  2
                )
              : _vm._e(),
          _vm._v(" "),
          _vm.showPagination
            ? _c(
                "div",
                {
                  class: [
                    "sky-list-pagination",
                    "type-" + _vm.config.paginationType
                  ]
                },
                [
                  _vm.morePagination
                    ? _c(
                        "button",
                        {
                          staticClass: "sky-list-more",
                          on: {
                            click: function($event) {
                              _vm.more(_vm.config.paginationType === "all");
                            }
                          }
                        },
                        [
                          _vm._t(
                            "listMore",
                            [
                              _c("span", {
                                domProps: {
                                  textContent: _vm._s(
                                    "Show " + _vm.config.paginationType
                                  )
                                }
                              })
                            ],
                            { itemsLeft: _vm.itemsLeft }
                          )
                        ],
                        2
                      )
                    : _vm._e(),
                  _vm._v(" "),
                  _vm.numericPagination
                    ? _c(
                        "ul",
                        { staticClass: "sky-list-numeric" },
                        _vm._l(_vm.pages.max, function(n) {
                          return _c(
                            "li",
                            { class: { current: _vm.pages.current === n } },
                            [
                              _c(
                                "button",
                                {
                                  on: {
                                    click: function($event) {
                                      _vm.goTo(n);
                                    }
                                  }
                                },
                                [
                                  _vm._t(
                                    "paginationBullet",
                                    [
                                      _c("span", {
                                        domProps: { textContent: _vm._s(n) }
                                      })
                                    ],
                                    { count: n }
                                  )
                                ],
                                2
                              )
                            ]
                          )
                        })
                      )
                    : _vm._e(),
                  _vm._v(" "),
                  _vm.flowPagination
                    ? _c(
                        "button",
                        {
                          staticClass: "sky-list-previous",
                          on: {
                            click: function($event) {
                              _vm.goTo("previous");
                            }
                          }
                        },
                        [
                          _vm._t("listPrev", [_c("span", [_vm._v("Previous")])])
                        ],
                        2
                      )
                    : _vm._e(),
                  _vm._v(" "),
                  _vm.flowPagination
                    ? _c(
                        "button",
                        {
                          staticClass: "sky-list-next",
                          on: {
                            click: function($event) {
                              _vm.goTo("next");
                            }
                          }
                        },
                        [_vm._t("listNext", [_c("span", [_vm._v("Next")])])],
                        2
                      )
                    : _vm._e()
                ]
              )
            : _vm._e()
        ])
      : _vm._e()
  ])
};
var __vue_staticRenderFns__ = [];
__vue_render__._withStripped = true;

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
    component.__file = "/Users/rudiornhoj/Sites/roernhoej/sky-list/src/SkyList.vue";

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
  )

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
