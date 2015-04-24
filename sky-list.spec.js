(function() {
	'use strict';

	describe('Controller: SkyListCtrl',function() {
		beforeEach(module('skyList'));

		var SkyListCtrl,
			$scope,
			$httpBackend;

		beforeEach(inject(function($rootScope,$controller,_$httpBackend_) {
			$scope = $rootScope.$new();
			$httpBackend = _$httpBackend_;
			SkyListCtrl = $controller('SkyListCtrl',{
				$scope:$scope
			});
		}));

		it('should have a getNext method on $scope', function() {
			expect($scope.getNext).toBeDefined();
		});

		it('should have a getPrev method on $scope', function() {
			expect($scope.getPrev).toBeDefined();
		});

		it('should have a getResults method on $scope', function() {
			expect($scope.getResults).toBeDefined();
		});

		it('should send preferences and query when using the API', function() {
			$scope.prefs.api = '/api';
			$scope.prefs.limit = '10';

			$scope.query.keywords='something';

			$scope.getResults();

			$httpBackend.expect('GET','/api?keywords=something&limit=10&offset=0').respond(200,[]);

			$httpBackend.flush();
		});

		it('should send offset to api-call', function() {
			$scope.prefs.api = '/api';
			$scope.prefs.limit = '10';

			$scope.getResults(20);

			$httpBackend.expect('GET','/api?limit=10&offset=20').respond(200,[]);

			$httpBackend.flush();
		});


		it('getNext() should call getResults and change offset',function() {
			$scope.prefs.limit=10;

		//	$scope.getResults();

			var spy = spyOn($scope,'getResults');

			$scope.getNext();

			expect(spy).toHaveBeenCalledWith(10);
		});

		it('getNext() should call getResults and change offset',function() {
			$scope.prefs.limit=10;

		//	$scope.getResults();

			$scope.getNext();
			var spy = spyOn($scope,'getResults');

			$scope.getNext();

			expect(spy).toHaveBeenCalledWith(20);
		});


		it('getPrev() should call getResults and change offset', function() {
		//	$scope.getResults();
			$scope.getNext();

			var spy = spyOn($scope,'getResults');

			$scope.getPrev();

			expect(spy).toHaveBeenCalledWith(0);
		});






	});
})();
