(function() {
	"use strict";

	angular.module('skyList').directive('skyListController', skyListControllerDirective);

	skyListControllerDirective.$inject = ['skyList'];

	function skyListControllerDirective(skyList) {
		let directive = {
			restrict: 'A',
			bindToController: {
				'list': '@skyListController',
			},
			controllerAs: 'skyListCtrl',
			controller: controller,
		};

		function controller() {
			this.list = this.list || 'search';

			skyList.getInstance(this.list).then((instance) => {
				this.query = instance.query;
			});
		}

		return directive;
	}
})();
