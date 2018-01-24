angular.module('vott', [
    'vott.project-list',
    'vott.project-details',
    'vott.project-images',
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
    .otherwise({
        redirectTo: '/projects'
    });
});
