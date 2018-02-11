angular.module('vott.project-list', [
    'vott.factories'
]).controller('ProjectListController', function ($scope, $location, $route, ProjectService) {
    $scope.isAuthorized = false;
    $scope.getProjects = function() {
        $scope.isLoading = true;
        ProjectService.getProjects().then(function(response){
            $scope.isLoading = false;
            $scope.isAuthorized = true;
            $scope.projects = response.data;
        }).catch(function(error){
            if (error.status == 403) {
                $scope.isLoading = false;
                $scope.projects = [];
                return;
            }
            console.log(error);
            $scope.error = error;
        });
    };
    $scope.createProject = function() {
        $location.path('/projects/new');
    };
    $scope.editProject = function(project) {
        $location.path(`/projects/${project.id}`);
    };
    $scope.deleteProject = function(project) {
        $scope.selectedProject = project;
        $('#projectDeleteConfirmation').modal('show');
    };
    $scope.confirmDeleteProject = function(project) {
        $('#projectDeleteConfirmation').modal('hide');
        ProjectService.deleteProject(project.id).then(function(response){
            $route.reload();
        }).catch(function(error){
            console.log(error);
            $scope.error = error;
        });
    };

    $scope.getProjects();

});
