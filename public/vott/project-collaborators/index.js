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

  $scope.invite = function (collaborator) {
    $scope.selectedCollaborator = {};
    $('#editDialog').modal('show');
  };

  $scope.reinvite = function (collaborator) {
    ProjectService.reinviteCollaborator($routeParams.projectId, collaborator.collaboratorId)
      .then(function (response) {
        alert(`Reinvited ${collaborator.name}.`);
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  }

  $scope.delete = function (collaborator) {
    $scope.selectedCollaborator = collaborator;
    $('#deleteConfirmation').modal('show');
  };

  $scope.deleteConfirmed = function (collaborator) {
    ProjectService.deleteCollaborator(
      $routeParams.projectId,
      collaborator.collaboratorId
    ).then(function (response) {
      $scope.selectedCollaborator = {};
      $scope.loadCollaborators();
      $('#deleteConfirmation').modal('hide');
    }).catch(function (error) {
      console.log(error);
      $scope.error = error;
    });
  };

  $scope.save = function () {
    ProjectService.createCollaborator(
      $routeParams.projectId,
      $scope.selectedCollaborator.name,
      $scope.selectedCollaborator.email,
      $scope.selectedCollaborator.profile
    ).then(function (response) {
      $scope.selectedCollaborator = {};
      $scope.loadCollaborators();
    }).catch(function (error) {
      console.log(error);
      $scope.error = error;
    });
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
