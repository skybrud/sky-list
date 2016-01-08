declare module sky {
	interface ISkyList {
		results:Object;
		getResults(query:Object, offset?:Number):void;
		getNext(offset:Number):void;
		getPrevious(offset:Number):void;
		empty():void;
	}
	interface ISkyListFactory {
		createInstance(token:string, instancePreferences?: ISkyListPreferences):ng.IPromise<ISkyList>;
		getInstance(token:string):ng.IPromise<ISkyList>;
		killInstance(token: string): void;
	}
	interface ISkyListPreferences {
		api?:string;
		limit?:number;
		pagination?:boolean;
		debounceTime?:number;
	}
	interface ISkyListMergedPreferences {
		api:string;
		limit:number;
		pagination:boolean;
		debounceTime:number;
	}
}

(function() {
	'use strict';
	
	angular.module('skyList').factory('skyList',skyListFactory);	
	
	skyListFactory.$inject = ['$http','$q','$timeout'];
	
	function skyListFactory($http, $q, $timeout:ng.ITimeoutService):sky.ISkyListFactory {
		var factory = this;
		factory.deferreds = {};
		
		return {
			createInstance(token, instancePreferences: sky.ISkyListPreferences = {}) {
				// Create a deferred if not exists
				if(!factory.deferreds[token]) {
					factory.deferreds[token] = $q.defer();
				}
				
				// Throw error if it has already been resolved
				if(factory.deferreds[token].promise.$$state.status == 1) {
					throw new Error('Instance with token: "'+name+'" already exists. Use getInstance(token: string) to get existing instance.');
				}

				// Resolve the deferred with a new instance
				factory.deferreds[token].resolve(new SkyList(instancePreferences));
					
				// Return the promise of the deferred
				return factory.deferreds[token].promise;			
			},
			getInstance(token: string) {
				// Create a deferred if not exists
				if (!factory.deferreds[token]) { 
					factory.deferreds[token] = $q.defer();
				}		
				
				// Return the promise of the deferred
				return factory.deferreds[token].promise;
			},
			killInstance(token: string) {
				delete factory.instances[token];
				delete factory.deferreds[token];
			}
		}

		function SkyList(instancePreferences:sky.ISkyListPreferences) {
			var _this = this;
			_this.results = {
				pagination:{
					total:0	
				},
				items:[]
			};
			var defaultPreferences = {
				api:'/umbraco/api/News/GetNews/',
				limit:10,
				pagination:false,
				debounceTime:200
			};
			
			var currentOffset: number = 0;
			var preferences: sky.ISkyListMergedPreferences = angular.extend(defaultPreferences, instancePreferences);
			var currentQuery: Object;
			
			var debounceTimer:ng.IPromise<any>;			
			var canceler: ng.IDeferred<any> = $q.defer();
				
			_this.getResults = function(query:Object = {}, offset:number = 0) {
				currentQuery = query;
				currentOffset = offset;
								
				$timeout.cancel(debounceTimer);
				debounceTimer = $timeout(function() {
					// Cancel last request by resolving the canceler
					canceler.resolve();

					// Create and reassign new canceler
					canceler = $q.defer();

					$http({
						method:'GET',
						url:preferences.api,
						timeout:canceler.promise, /* use canceler-promise as timeout argument to allow later cancelation of $http */
						params: angular.extend({
							limit: preferences.limit,
							offset: currentOffset
						},query)
					}).then(function(res) {
						_this.results.pagination = res.data.pagination;
						
						if(offset === 0 || preferences.pagination) {
							_this.results.items = res.data.data;
						} else {
							_this.results.items = _this.results.items.concat(res.data.data);
						}
					});
				
				},preferences.debounceTime);	
				
			};
			
			_this.empty = function() {
				_this.results.items = [];
				_this.results.pagination.total=0;		
			};
			
			_this.getNext = function() {
				return _this.getResults(currentQuery, currentOffset + preferences.limit);
			};
			
			_this.getPrevious = function() {
				return _this.getResults(currentQuery, Math.max(currentOffset - preferences.limit,0));
			};	
		} 
	}
	
})();
