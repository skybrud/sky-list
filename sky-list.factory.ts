(function() {
	'use strict';

	angular.module('skyList').factory('skyList',skyListFactory);

	skyListFactory.$inject = ['$http','$q','$timeout', 'skyPath', '$location'];

	function skyListFactory($http, $q, $timeout, skyPath, $location) {
		var factory = this;
		factory.instances = {};
		factory.deferreds = {};

		return {
			createInstance(token, instancePreferences = {}) {
				if(factory.instances[token]) {
					throw new Error('Instance with token: "'+name+'" already exists. Use getInstance(token: string) to get existing instance.');
				}

				// Create the instance
				factory.instances[token] = new SkyList(instancePreferences);

				// Handle async get'ers
				if(!factory.deferreds[token]) {
					var deferred = $q.defer()
					factory.deferreds[token]=deferred;
				}
				factory.deferreds[token].resolve(factory.instances[token]);

				return factory.deferreds[token].promise;
			},
			getInstance(token: string) {
				if (!factory.deferreds[token]) {
					var deferred = $q.defer()
					factory.deferreds[token]=deferred;
				}
				return factory.deferreds[token].promise;
			},
			killInstance(token: string) {
				delete factory.deferreds[token];
				delete factory.instances[token];
			}
		}

		function SkyList(instancePreferences) {
			// Default
			const defaultPreferences = {
				api:'/umbraco/api/News/GetNews/',
				limit:10,
				pagination:false,
				debounceTime:200
			};

			// List preferences
			const preferences = angular.extend(defaultPreferences, instancePreferences);

			// Used to cancel the request
			let cancel = $q.defer()

			let debounceTimer;

			// List query
			this.query = {};

			// The current offset
			this.offset = 0;

			// Result object
			this.results = {
				pagination:{
					total:0
				},
				items:[]
			};

			/**
			 * Fetch results based on the current query and offset.
			 *
			 * @param {number} [optional] offset
			 * @return {promise}
			 */
			this.getResults = (offset = 0) => {
				// Cancel any ongoing requests
				this.cancel();

				// set the offset
				this.offset = offset;

				// Endpoint
				let url = skyPath.get() + preferences.api;

				// Merged params
				let params = angular.extend({
					limit: preferences.limit,
					offset: this.offset,
				}, this.query);

				// Cancel any queued requests
				$timeout.cancel(this.debounce);
				this.debounce = $timeout(() => {

					$http({
						method: 'GET',
						url: url,
						params: params,
						timeout: cancel.promise,
					}).then((res) => {

						// Update pagination
						this.results.pagination = res.data.pagination;

						// Either replace items or cancat
						if(this.offset === 0 || preferences.pagination) {
							this.results.items = res.data.data;
						} else {
							this.results.items = this.results.items.concat(res.data.data);
						}

						$location.search(this.query);
					});

				}, preferences.debounceTime);

			}

			// Reset list
			this.empty = () => {
				this.results.items = [];
				this.results.pagination.total=0;
			}

			// Increment offset
			this.nextPage = () => {
				return this.getResults(this.offset + preferences.limit);
			}

			// Cancel request
			this.cancel = () => {
				cancel.resolve();
				cancel = $q.defer();
			}
		}
	}

})();
