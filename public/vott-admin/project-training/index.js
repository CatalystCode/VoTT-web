angular.module('vott.project-training', [
  'vott.factories'
]).controller('ProjectTrainingController', function ($scope, $location, $route, $routeParams, ProjectService) {

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingModels = true;

  $scope.collaborators = [];
  $scope.nextPageToken = null;

  $scope.$watchGroup(['isLoadingProject', 'isLoadingModels'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingModels;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadModels();
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

  $scope.loadModels = function (paginationToken) {
    $scope.isLoadingModels = true;
    ProjectService.models($routeParams.projectId, paginationToken)
      .then(function (response) {
        const modelsData = response.data.data.models;
        $scope.models = modelsData.entries;
        $scope.nextPageToken = modelsData.nextPageToken;
        $scope.isLoadingModels = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.export = function (model) {
    window.location = `/v1/vott-training/projects/${$routeParams.projectId}/${model.modelId}/annotations.csv`;
  };

  $scope.train = function () {
    ProjectService.createModel($routeParams.projectId)
      .then(function (response) {
        const model = response.data.data.createModel;
        $scope.load();
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.promote = function (model) {
    console.log("Promote");
  };

  $scope.delete = function (model) {
    console.log("Delete");
    $scope.selectedModel = model;
    $('#modelDeleteConfirmation').modal('show');
  };

  $scope.deleteCancelled = function () {
    $scope.selectedModel = null;
    $('#modelDeleteConfirmation').modal('hide');
  }

  $scope.deleteConfirmed = function () {
    ProjectService.deleteModel($routeParams.projectId, $scope.selectedModel.modelId)
      .then(function (response) {
        $('#modelDeleteConfirmation').modal('hide');
        $scope.load();
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.save = function () {
    console.log("Save");
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
