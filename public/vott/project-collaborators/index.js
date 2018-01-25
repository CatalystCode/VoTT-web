angular.module('vott.project-collaborators', [
  'vott.factories'
]).controller('ProjectCollaboratorsController', function ($scope, $location, $route, $routeParams, ProjectService) {

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingImages = true;

  $scope.collaborators = [];
  $scope.nextPageToken = null;

  $scope.$watchGroup(['isLoadingProject', 'isLoadingCollaborators'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingCollaborators;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadCollaborators();
  };

  $scope.loadProject = function () {
    $scope.isLoadingProject = true;
    ProjectService.getProject($routeParams.projectId)
      .then(function (response) {
        $scope.project = response.data.data.project;
        $scope.isLoadingProject = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.loadCollaborators = function (paginationToken) {
    $scope.isLoadingCollaborators = true;
    ProjectService.collaborators($routeParams.projectId, paginationToken)
      .then(function (response) {
        const collaboratorsData = response.data.data.collaborators;
        $scope.collaborators = collaboratorsData.entries;
        $scope.nextPageToken = collaboratorsData.nextPageToken;
        $scope.isLoadingCollaborators = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.edit = function (collaborator) {
    console.log("Edit");
  };

  $scope.delete = function (collaborator) {
    console.log("Edit");
  };

  $scope.details = function () {
    $location.path(`/projects/${$routeParams.projectId}`);
  };

  $scope.manageImages = function () {
    $location.path(`/projects/${$routeParams.projectId}/images`);
  };

  $scope.manageCollaborators = function () {
    $scope.load();
  };

  $scope.manageModels = function () {
    $location.path(`/projects/${$routeParams.projectId}/models`);
  };

  $scope.load();

});
