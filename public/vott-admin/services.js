angular.module('vott.factories', [])
    .factory('ProjectService', function ($http) {
        const baseUrl = '/api/vott-admin';
        return {
            getProjects: function (nextPageToken) {
                const invocation = nextPageToken ? `projects(nextPageToken:${JSON.stringify(nextPageToken)})` : 'projects';
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: "query { " + invocation + "{ nextPageToken entries { projectId name taskType } } }" }
                });
            },
            getProject: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `query { project (projectId:${JSON.stringify(projectId)} ) { projectId name taskType labels instructionsText instructionsImageURL } }` }
                });
            },
            createProject: function (project) {
                const parameters = [
                    `name:${JSON.stringify(project.name)}`,
                    `taskType:${project.taskType}`,
                    `labels:${JSON.stringify(project.labels)}`,
                    `instructionsText:${JSON.stringify(project.instructionsText)}`
                ].join(', ');
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { createProject (${parameters}) { projectId } }` }
                });
            },
            updateProject: function (project) {
                const parameters = [
                    `projectId:${JSON.stringify(project.projectId)}`,
                    `name:${JSON.stringify(project.name)}`,
                    `taskType:${project.taskType}`,
                    `labels:${JSON.stringify(project.labels)}`,
                    `instructionsText:${JSON.stringify(project.instructionsText)}`
                ].join(', ');
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { updateProject (${parameters}) { projectId } }` }
                });
            },
            deleteProject: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { deleteProject (projectId:${JSON.stringify(projectId)}) }` }
                });
            },
            //  createInstructionsImage(projectId: String!): Image
            createInstructionsImage: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { createInstructionsImage (projectId:${JSON.stringify(projectId)}) { projectId fileId fileURL } }` }
                });
            },
            commitInstructionsImage: function (confirmedFile) {
                const parameters = [
                    `projectId:${JSON.stringify(confirmedFile.projectId)}`,
                    `fileId:${JSON.stringify(confirmedFile.fileId)}`
                ].join(', ');
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { commitInstructionsImage (image:{ ${parameters} }) }` }
                });
            },
            trainingImages: function (projectId, nextPageToken) {
                const invocation = nextPageToken ?
                    `trainingImages(projectId: ${JSON.stringify(projectId)}, nextPageToken:${JSON.stringify(nextPageToken)})` :
                    `trainingImages(projectId: ${JSON.stringify(projectId)})`;
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: "query { " + invocation + "{ nextPageToken entries { projectId fileId fileURL } } }" }
                });
            },
            trainingImageStats: function(projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `query { trainingImageStats (projectId:${JSON.stringify(projectId)}) {  statusCount { status count } } }` }
                });                
            },
            createTrainingImage: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { createTrainingImage (projectId:${JSON.stringify(projectId)}) { projectId fileId fileURL } }` }
                });
            },
            commitTrainingImage: function (projectId, fileId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { commitTrainingImage (projectId:${JSON.stringify(projectId)}, fileId:${JSON.stringify(fileId)}) { projectId fileId fileURL } }` }
                });
            },
            createCollaborator: function (projectId, name, email, profile) {
                const parameters = [
                    `projectId:${JSON.stringify(projectId)}`,
                    `name:${JSON.stringify(name)}`,
                    `email:${JSON.stringify(email)}`,
                    `profile:${profile}`, /* profile is an enum constant, not a string */
                ].join(', ');
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: {
                        query: `mutation {
                            createCollaborator (${parameters}) {
                                inviteId
                                inviteURL
                                collaborator {
                                projectId
                                collaboratorId
                                name
                                email
                                profile
                                }
                            }
                        }`
                    }
                });
            },
            reinviteCollaborator: function(projectId, collaboratorId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { reinviteCollaborator (projectId:${JSON.stringify(projectId)}, collaboratorId:${JSON.stringify(collaboratorId)}) { inviteId inviteURL } }` }
                });
            },
            collaborators: function (projectId, paginationToken) {
                const invocation = paginationToken ?
                    `collaborators(projectId: ${JSON.stringify(projectId)}, paginationToken:${JSON.stringify(paginationToken)})` :
                    `collaborators(projectId: ${JSON.stringify(projectId)})`;
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: "query { " + invocation + "{ nextPageToken entries { collaboratorId name email profile } } }" }
                });
            },
            deleteCollaborator: function(projectId, collaboratorId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { deleteCollaborator (projectId:${JSON.stringify(projectId)}, collaboratorId: ${JSON.stringify(collaboratorId)}) }` }
                });
            },
            models: function (projectId, paginationToken) {
                const invocation = paginationToken ?
                    `models(projectId: ${JSON.stringify(projectId)}, paginationToken:${JSON.stringify(paginationToken)})` :
                    `models(projectId: ${JSON.stringify(projectId)})`;
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: "query { " + invocation + "{ nextPageToken entries { modelId created status modelURL } } }" }
                });
            },
            createModel: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { createModel (projectId:${JSON.stringify(projectId)}) { projectId modelId status } }` }
                });
            },
            deleteModel: function (projectId, modelId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { deleteModel (projectId:${JSON.stringify(projectId)}, modelId: ${JSON.stringify(modelId)}) }` }
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
