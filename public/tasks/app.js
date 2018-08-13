angular.module('vott', [
    'vott.project-list',
    'vott.project-details',
    'vott.project-tasks',
    'ngRoute'
]).config(function ($routeProvider) {
    $routeProvider.when('/projects', {
        templateUrl: './project-list/index.html',
        controller: 'ProjectListController'
    })
    .when('/projects/:projectId', {
        templateUrl: './project-details/index.html',
        controller: 'ProjectDetailsController'
    })
    .when('/projects/:projectId/tasks', {
        templateUrl: './project-tasks/index.html',
        controller: 'ProjectTasksController'
    })
    .otherwise({
        redirectTo: '/projects'
    });
});
