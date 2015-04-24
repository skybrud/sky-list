/* global angular */
(function () {
	'use strict';

	/**
	 * Controller: skyListCtrl
	 * Base controller for lists.
	 *
	 * This controller has methods for getResults(), getNext()
	 * and getPrev().
	 *
	 * Settings via the $scope.prefs-object. Defaults are defined.
	 *
	 * Extend a specific controller with this controller like this:
	 * angular.extend(this,$controller('skyListCtrl',{$scope:$scope}));
	 *
	**/

	angular.module('skyList').controller('SkyListCtrl',SkyListCtrl);

	SkyListCtrl.$inject = ['$scope', '$http'];

	function SkyListCtrl($scope, $http) {

		var offset=0;

		// Default preferences
		$scope.prefs = {
			limit:10,
			api:'/umbraco/api/News/GetNews/'
		};
		$scope.query={};

		$scope.getNext = function() {
			// Add the limit-value to the current offset, to get the next set of results
			offset+=$scope.prefs.limit;
			// Return getResults() with custom offset
			return $scope.getResults(offset);
		};

		$scope.getPrev = function() {
			// Subtract the limit-value to the current offset, to get the next set of results
			offset-=$scope.prefs.limit;
			// Return getResults() with custom offset
			return $scope.getResults(Math.max(offset,0));
		};

		$scope.getResults = function(newOffset) {
			/*
			 * Set offset to zero when not called with offset (not called via getPrev()-
			 * and getNext()-methods)
			 */
			offset = newOffset || 0;

			// Returns $http-promise
			return $http({
				url:$scope.prefs.api,
				params: angular.extend({
					limit:$scope.prefs.limit,
					offset:offset
				},$scope.query)
			});
		};

	}

})();
