angular.module('vott.factories', [])
    .factory('ProjectService', function ($http) {
        const baseUrl = '/v1/graphql/projects';
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
                    data: { query: `query { project (projectId:${JSON.stringify(projectId)} ) { projectId name taskType objectClassNames instructionsText instructionsImageURL } }` }
                });
            },
            createProject: function (project) {
                const parameters = [
                    `name:${JSON.stringify(project.name)}`,
                    `taskType:${project.taskType}`,
                    `objectClassNames:${JSON.stringify(project.objectClassNames)}`,
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
                    `objectClassNames:${JSON.stringify(project.objectClassNames)}`,
                    `instructionsText:${JSON.stringify(project.instructionsText)}`
                ].join(', ');
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { updateProject (${parameters}) { projectId } }` }
                });
            },
            removeProject: function (projectId) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: `mutation { removeProject (projectId:${JSON.stringify(projectId)}) }` }
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
            images: function (projectId, nextPageToken) {
                const invocation = nextPageToken ?
                    `images(projectId: ${JSON.stringify(projectId)}, nextPageToken:${JSON.stringify(nextPageToken)})` :
                    `images(projectId: ${JSON.stringify(projectId)})`;
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: "query { " + invocation + "{ nextPageToken entries { projectId fileId fileURL } } }" }
                });
            },
            createImages: function (projectId, imageCount) {
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: 'mutation { createImages(projectId: ' + JSON.stringify(projectId) + ', imageCount: ' + JSON.stringify(imageCount) + ') { projectId fileId fileURL } }' }
                });
            },
            commitImages: function (images) {
                const escapedImages = images.map(function (value) {
                    return '{ projectId: ' + JSON.stringify(value.projectId) + ', fileId: ' + JSON.stringify(value.fileId) + ' } ';
                });
                return $http({
                    method: 'POST',
                    url: baseUrl,
                    data: { query: 'mutation { commitImages(images: [' + escapedImages.join() + '] ) }' }
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
