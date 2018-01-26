angular.module('vott.project-models', [
  'vott.factories'
]).controller('ProjectModelsController', function ($scope, $location, $route, $routeParams, ProjectService) {

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

  $scope.train = function(collaborator) {
  };

  $scope.promote = function(collaborator) {
  };

  $scope.delete = function (collaborator) {
    console.log("Edit");
  };

  $scope.save = function () {
  };

  $scope.details = function () {
    $location.path(`/projects/${$routeParams.projectId}`);
  };

  $scope.manageImages = function () {
    $location.path(`/projects/${$routeParams.projectId}/images`);
  };

  $scope.manageCollaborators = function () {
    $location.path(`/projects/${$routeParams.projectId}/collaborators`);
  };

  $scope.manageModels = function () {
    $location.load();
  };

  $scope.load();

});
