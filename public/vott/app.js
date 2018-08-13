angular.module('vott', [
    'vott.project-list',
    'vott.project-details',
    'vott.project-images',
    'vott.project-collaborators',
    'vott.project-training',
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
    .when('/projects/:projectId/images', {
        templateUrl: './project-images/index.html',
        controller: 'ProjectImagesController'
    })
    .when('/projects/:projectId/collaborators', {
        templateUrl: './project-collaborators/index.html',
        controller: 'ProjectCollaboratorsController'
    })
    .when('/projects/:projectId/models', {
        templateUrl: './project-training/index.html',
        controller: 'ProjectTrainingController'
    })
    .when('/projects/:projectId/tasks', {
        templateUrl: './project-tasks/index.html',
        controller: 'ProjectTasksController'
    })
    .otherwise({
        redirectTo: '/projects'
    });
});
