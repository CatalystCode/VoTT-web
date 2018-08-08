angular.module('vott.project-details', [
    'vott.factories'
]).controller('ProjectDetailsController', function ($scope, $location, $route, $routeParams, ProjectService) {
    $scope.totalImageCount = 0;
    $scope.taggedImageCount = 0;
    $scope.conflictImageCount = 0;

    $scope.isNewRecord = function () {
        return $routeParams.projectId == 'new';
    }
    $scope.loadRecord = function () {
        if ($scope.isNewRecord()) {
            $scope.project = {labels:[]};
            $scope.isLoading = false;
        }
        else {
            $scope.isLoading = true;
            ProjectService.getProject($routeParams.projectId)
                .then(function (response) {
                    $scope.isLoading = false;
                    $scope.project = response.data;
                })
                .catch(function (error) {
                    console.log(error);
                    $scope.error = error;
                });
        }
    }
    $scope.cancel = function () {
        $location.path('/projects');
    }
    $scope.create = function () {
        ProjectService.createProject($scope.project)
            .then(function (response) {
                $location.path('/projects');
            })
            .catch(function (error) {
                $scope.error = error;
            });
    };
    $scope.update = function () {
        ProjectService.updateProject($scope.project)
            .then(function (response) {
                $location.path('/projects');
            })
            .catch(function (error) {
                $scope.error = error;
            });
    };
    $scope.save = function () {
        if ($scope.isNewRecord()) {
            $scope.create();
        } else {
            $scope.update();
        }
    };

    $scope.details = function () {
        $scope.loadRecord();
    }

    $scope.manageImages = function () {
        $location.path(`/projects/${$routeParams.projectId}/images`);
    };

    $scope.manageCollaborators = function () {
        $location.path(`/projects/${$routeParams.projectId}/collaborators`);
    };

    $scope.manageModels = function () {
        $location.path(`/projects/${$routeParams.projectId}/models`);
    };

    $scope.manageTasks = function() {
        $location.path(`/projects/${$routeParams.projectId}/tasks`);
    };

    $scope.instructionsImageURL = function() {
        if (!$scope.project.instructionsImageId) {
            return null;
        }
        return `/api/vott/v1/projects/${$routeParams.projectId}/images/${$scope.project.instructionsImageId}`;
    }

    /**
     * Quasi-angular handler for changes in the instructions image <input type="file"> element.
     */
    $scope.instructionsImageFileDidChange = function () {
        const imageFile = $("#instructionsImage");
        if (!imageFile.val()) {
            console.log("Please select an image to upload.");
            return;
        }

        $('#uploadProgressBar').attr('value', 0);
        $('#uploadProgressModal').modal('show');
        const projectId = $scope.project.id;
        const files = imageFile[0].files;
        const file = files[0];
        ProjectService.createInstructionsImage(projectId).then(function (response) {
            console.log(response);
            const imageRecord = response.data;
            $scope.uploadInstructionsImage(imageRecord, file);
        }).catch(function (error) {
            console.log(error);
            $scope.error = error;
        });
    };

    $scope.uploadInstructionsImage = function (imageRecord, file) {
        const projectId = $routeParams.projectId;
        const reader = new FileReader();
        reader.onload = function (event) {
            if (event.target.readyState != FileReader.DONE) {
                return;
            }

            const data = new Uint8Array(event.target.result);
            $scope.uploadImageToAzureStorageBlob(
                file.type,
                data,
                imageRecord.url,
                function (error, result, status) {
                    if (error) {
                        $scope.error = error;
                        return;
                    }

                    $('#uploadProgressBar').attr('value', 100);
                    $('#uploadProgressBar').attr('max', 100);
                    imageRecord.name = file.name;
                    ProjectService.commitInstructionsImage(projectId, imageRecord).then(function (response) {
                        $('#uploadProgressModal').modal('hide');
                        $scope.loadRecord();
                    }).catch(function (error) {
                        $scope.error = error;
                        console.log(error);
                        $('#uploadProgressModal').modal('hide');
                    });
                },
                function (error) {
                    console.log(error);
                    $scope.error = error;
                },
                function (progressEvent) {
                    if (!progressEvent.lengthComputable) {
                        return;
                    }
                    $("#uploadProgressBar").attr("value", progressEvent.loaded);
                    $("#uploadProgressBar").attr("max", progressEvent.total);
                }
            );
        };
        reader.readAsArrayBuffer(file);
    };


    $scope.uploadImageToAzureStorageBlob = function (contentType, data, url, successCallback, errorCallback, progressCallback) {
        $.ajax({
            url: url,
            type: "PUT",
            data: data,
            $scope: $scope,
            processData: false,
            xhr: function () {
                var request = new XMLHttpRequest();
                request.upload.addEventListener("progress", progressCallback, false);
                // request.addEventListener("progress", uploadProgress);
                return request;
            },
            beforeSend: function (xhr) {
                $scope.uploadXhr = xhr;
                xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
                xhr.setRequestHeader('x-ms-blob-content-type', contentType);
            },
            success: successCallback,
            error: errorCallback
        });
    };

    $scope.loadRecord();
});
