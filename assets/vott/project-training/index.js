angular.module('vott.project-training', [
  'vott.factories'
]).controller('ProjectTrainingController', function ($scope, $location, $route, $routeParams, ProjectService) {

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingTrainingRequests = true;

  $scope.collaborators = [];
  $scope.nextPageToken = null;

  $scope.$watchGroup(['isLoadingProject', 'isLoadingTrainingRequests'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingTrainingRequests;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadTrainingRequests();
  };

  $scope.loadProject = function () {
    $scope.isLoadingProject = true;
    ProjectService.getProject($routeParams.projectId)
      .then(function (response) {
        $scope.project = response.data;
        $scope.isLoadingProject = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.loadTrainingRequests = function (paginationToken) {
    $scope.isLoadingTrainingRequests = true;
    ProjectService.trainingRequests($routeParams.projectId)
      .then(function (response) {
        $scope.trainingRequests = response.data;
        $scope.isLoadingTrainingRequests = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.export = function (request) {
    window.location = `/v1/vott-training/projects/${$routeParams.projectId}/${request.id}/annotations.csv`;
  };

  $scope.train = function () {
    ProjectService.createTrainingRequest($routeParams.projectId)
      .then(function (response) {
        $scope.load();
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.promote = function (request) {
    console.log("Promote");
  };

  $scope.delete = function (trainingRequest) {
    console.log("Delete");
    $scope.selectedRequest = trainingRequest;
    $('#deleteConfirmation').modal('show');
  };

  $scope.deleteCancelled = function () {
    $scope.selectedRequest = null;
    $('#deleteConfirmation').modal('hide');
  }

  $scope.deleteConfirmed = function () {
    ProjectService.deleteTrainingRequest($routeParams.projectId, $scope.selectedRequest.id)
      .then(function (response) {
        $('#deleteConfirmation').modal('hide');
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
