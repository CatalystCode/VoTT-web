angular.module('vott', [
    'vott.project-list',
    'vott.project-details',
    'ngRoute'
]).config(function ($routeProvider) {
    $routeProvider.when('/projects', {
        templateUrl: './project-list/index.html',
        controller: 'ProjectListController'
    }).when('/projects/:projectId', {
        templateUrl: './project-details/index.html',
        controller: 'ProjectDetailsController'
    }).otherwise({
        redirectTo: '/projects'
    });
});
