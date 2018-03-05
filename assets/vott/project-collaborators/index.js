angular.module('vott.project-collaborators', [
  'vott.factories'
]).controller('ProjectCollaboratorsController', function ($scope, $location, $route, $routeParams, ProjectService) {

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingImages = true;

  $scope.accessRights = [];

  $scope.$watchGroup(['isLoadingProject', 'isLoadingAccessRights'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingAccessRights;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadAccessRights();
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

  $scope.loadAccessRights = function () {
    $scope.isLoadingAccessRights = true;
    ProjectService.collaborators($routeParams.projectId)
      .then(function (response) {
        $scope.accessRights = response.data;
        $scope.isLoadingAccessRights = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.invite = function (accessRight) {
    $scope.user = {};
    $('#editDialog').modal('show');
  };

  $scope.reinvite = function (accessRight) {
    console.log("About to reinvite:");
    console.log(accessRight.user);
    ProjectService.createCollaborator(
      $routeParams.projectId,
      accessRight.user.name,
      accessRight.user.email,
      accessRight.user.role
    ).then(function (response) {
      console.log("Created user:");
      console.log(response.data);
      $scope.user = {};
      $scope.loadAccessRights();
    }).catch(function (error) {
      console.log(error);
      $scope.error = error;
      $scope.loadAccessRights();
    });
  }

  $scope.delete = function (accessRight) {
    $scope.selectedAccessRight = accessRight;
    $('#deleteConfirmation').modal('show');
  };

  $scope.deleteConfirmed = function (accessRight) {
    ProjectService.deleteCollaborator(
      $routeParams.projectId,
      accessRight.id
    ).then(function (response) {
      $scope.selectedAccessRight = {};
      $scope.loadAccessRights();
      $('#deleteConfirmation').modal('hide');
    }).catch(function (error) {
      console.log(error);
      $scope.error = error;
    });
  };

  $scope.save = function () {
    ProjectService.createCollaborator(
      $routeParams.projectId,
      $scope.user.name,
      $scope.user.email,
      $scope.user.role
    ).then(function (response) {
      console.log("Created user:");
      console.log(response.data);
      $scope.user = {};
      $scope.loadAccessRights();
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

  $scope.manageTasks = function () {
    $location.path(`/projects/${$routeParams.projectId}/tasks`);
  };

  $scope.load();

});
