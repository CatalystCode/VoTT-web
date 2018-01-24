angular.module('vott.project-list', [
    'vott.factories'
]).controller('ProjectListController', function ($scope, $location, $route, ProjectService) {
    $scope.getProjects = function(paginationToken) {
        $scope.isLoading = true;
        ProjectService.getProjects(paginationToken).then(function(response){
            $scope.isLoading = false;
            const projectsData = response.data.data.projects;
            $scope.paginationToken = projectsData.nextPageToken;
            $scope.projects = projectsData.entries;
        }).catch(function(error){
            console.log(error);
            $scope.error = error;
        });
    };
    $scope.createProject = function() {
        $location.path('/projects/new');
    };
    $scope.editProject = function(project) {
        $location.path(`/projects/${project.projectId}`);
    };
    $scope.deleteProject = function(project) {
        $scope.selectedProject = project;
        $('#projectDeleteConfirmation').modal('show');
    };
    $scope.confirmDeleteProject = function(project) {
        $('#projectDeleteConfirmation').modal('hide');
        ProjectService.removeProject(project.projectId).then(function(response){
            $route.reload();
        }).catch(function(error){
            console.log(error);
            $scope.error = error;
        });
    };

    $scope.getProjects();

});
