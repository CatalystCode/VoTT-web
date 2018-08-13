angular.module('vott.factories', [])
    .factory('ProjectService', function ($http) {
        const baseUrl = '/api/vott/v1';
        return {
            getProjects: function (skip, limit) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects`
                });
            },
            getProject: function (projectId) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects/${projectId}`
                });
            },
            createProject: function (project) {
                if (typeof (project.labels) == 'string') {
                    project.labels = project.labels.split(',').map(v => v.trim());
                }
                return $http({
                    method: 'POST',
                    url: `${baseUrl}/projects`,
                    data: project
                });
            },
            updateProject: function (project) {
                if (typeof (project.labels) == 'string') {
                    project.labels = project.labels.split(',').map(v => v.trim());
                }
                return $http({
                    method: 'PUT',
                    url: `${baseUrl}/projects/${project.id}`,
                    data: project
                });
            },
            deleteProject: function (projectId) {
                return $http({
                    method: 'DELETE',
                    url: `${baseUrl}/projects/${projectId}`
                });
            },
            //  createInstructionsImage(projectId: String!): Image
            createInstructionsImage: function (projectId) {
                return $http({
                    method: 'POST',
                    url: `${baseUrl}/projects/${projectId}/instructionsImage`
                });
            },
            commitInstructionsImage: function (projectId, image) {
                return $http({
                    method: 'PUT',
                    url: `${baseUrl}/projects/${projectId}/instructionsImage`,
                    data: image
                });
            },
            trainingImages: function (projectId, currentToken, limit) {
                const query = [];
                if (currentToken) {
                    query.push(`currentToken=${currentToken}`);
                }
                if (limit) {
                    query.push(`limit=${limit}`);
                }
                var url = `${baseUrl}/projects/${projectId}/trainingImages`
                if (query.length) {
                    url += '&' + query.join('&');
                }
                return $http({
                    method: 'GET',
                    url: url
                });
            },
            trainingImageStats: function (projectId) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects/${projectId}/trainingImages/stats`
                });
            },
            createTrainingImage: function (projectId) {
                const url = `${baseUrl}/projects/${projectId}/trainingImages`;
                console.log(`Creating training image with: ${url}`);
                return $http({
                    method: 'POST',
                    url: url,
                    data: { projectId: projectId }
                });
            },
            commitTrainingImage: function (image) {
                const url = `${baseUrl}/projects/${image.projectId}/trainingImages/${image.id}`;
                console.log(`Committing training image with: ${url}`);
                return $http({
                    method: 'PUT',
                    url: url,
                    data: image
                });
            },
            createCollaborator: function (projectId, userId, email, role) {
                console.log(`createCollaborator: ${projectId}, ${userId}, ${email}, ${role}`)
                return $http({
                    method: 'POST',
                    url: `${baseUrl}/projects/${projectId}/accessRights`,
                    data: {
                        projectId: projectId,
                        userId: userId,
                        email: email,
                        role: role
                    }
                });
            },
            collaborators: function (projectId) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects/${projectId}/accessRights`
                });
            },
            deleteCollaborator: function (projectId, collaboratorId) {
                console.log("deleteCollaborator:");
                console.log(projectId);
                console.log(collaboratorId);
                return $http({
                    method: 'DELETE',
                    url: `${baseUrl}/projects/${projectId}/accessRights/${collaboratorId}`
                });
            },
            trainingRequests: function (projectId) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects/${projectId}/trainingRequests`,
                });
            },
            createTrainingRequest: function (projectId, trainingRequest) {
                return $http({
                    method: 'POST',
                    url: `${baseUrl}/projects/${projectId}/trainingRequests`
                });
            },
            deleteTrainingRequest: function (projectId, trainingRequestId) {
                return $http({
                    method: 'DELETE',
                    url: `${baseUrl}/projects/${projectId}/trainingRequests/${trainingRequestId}`
                });
            },
            pullTask: function (projectId) {
                return $http({
                    method: 'GET',
                    url: `${baseUrl}/projects/${projectId}/tasks/next`
                });
            },
            //http://localhost:1337/api/vott/v1/projects/a5c931ca-88af-455d-a9e9-b87ba46ede31/tasks/next
            pushTask: function (projectId, task) {
                return $http({
                    method: 'POST',
                    url: `${baseUrl}/projects/${projectId}/tasks/results`,
                    data: task
                });
            },
            uploadImageToAzureStorageBlob: function (contentType, data, url, successCallback, errorCallback, progressCallback) {
                $.ajax({
                    url: url,
                    type: "PUT",
                    data: data,
                    processData: false,
                    xhr: function () {
                        var request = new XMLHttpRequest();
                        request.upload.addEventListener("progress", progressCallback, false);
                        // request.addEventListener("progress", uploadProgress);
                        return request;
                    },
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
                        xhr.setRequestHeader('x-ms-blob-content-type', contentType);
                    },
                    success: successCallback,
                    error: errorCallback
                });
            }
        };
    });
