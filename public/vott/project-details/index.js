angular.module('vott.project-details', [
    'vott.factories'
]).controller('ProjectDetailsController', function ($scope, $location, $route, $routeParams, Projects) {
    $scope.isNewRecord = function () {
        return $routeParams.projectId == 'new';
    }
    $scope.cancel = function () {
        $location.path('/projects');
    }
    $scope.create = function () {
        Projects.createProject($scope.project)
            .then(function (response) {
                $location.path('/projects');
            })
            .catch(function (error) {
                $scope.error = error;
            });
    };
    $scope.update = function () {
        console.log("Hello from update()");
        Projects.updateProject($scope.project)
            .then(function (response) {
                $location.path('/projects');
            })
            .catch(function (error) {
                $scope.error = error;
            });
    };
    $scope.save = function () {
        if ($scope.isNewRecord()) {
            $scope.create();
        } else {
            $scope.update();
        }
    };

    if ($scope.isNewRecord()) {
        $scope.project = {};
        $scope.isLoading = false;
    }
    else {
        $scope.isLoading = true;
        Projects.getProject($routeParams.projectId)
            .then(function (response) {
                $scope.project = response.data.data.project;
                $scope.isLoading = false;
            })
            .catch(function (error) {
                console.log(error);
                $scope.error = error;
            });
    }
});
