angular.module('vott.project-images', [
  'vott.factories'
]).controller('ProjectImagesController', function ($scope, $location, $route, $routeParams, $timeout, ProjectService) {

  $scope.totalImageCount = 0;
  $scope.taggedImageCount = 0;
  $scope.conflictImageCount = 0;

  $scope.images = [];
  $scope.isUploading = false;
  $scope.uploadProgress = 0;

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingImages = true;
  $scope.$watchGroup(['isLoadingProject', 'isLoadingImages'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingImages;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadImages();
  };

  $scope.loadProject = function () {
    $scope.isLoadingProject = true;
    ProjectService.getProject($routeParams.projectId)
      .then(function (response) {
        $scope.project = response.data.data.project;
        $scope.isLoadingProject = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.loadImages = function (paginationToken) {
    $scope.isLoadingImages = true;
    const requestedPaginationToken = paginationToken;
    ProjectService.trainingImages($routeParams.projectId, paginationToken)
      .then(function (response) {
        const serviceData = response.data.data.trainingImages;
        $scope.isLoadingImages = false;
        $scope.nextPageToken = serviceData.nextPageToken;
        if (requestedPaginationToken) {
          if (serviceData.entries) {
            for (var imageIndex = 0; imageIndex < serviceData.entries.length; imageIndex++) {
              $scope.images.push(serviceData.entries[imageIndex]);
            }
          }
        } else {
          $scope.images = serviceData.entries ? serviceData.entries : [];
        }
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.details = function() {
    $location.path(`/projects/${$routeParams.projectId}`);
  }

  $scope.manageImages = function () {
    $scope.load();
  };

  $scope.manageCollaborators = function () {
    $location.path(`/projects/${$routeParams.projectId}/collaborators`);
  };

  $scope.manageModels = function () {
    $location.path(`/projects/${$routeParams.projectId}/models`);
  };

  $scope.upload = function () {
    $('#uploadDialog').modal('show');
  };

  /**
   * Quasi-angular handler for changes in the instructions image <input type="file"> element.
   */
  $scope.imageFilesDidChange = function () {
    const imageFiles = $("#imageFiles");
    if (!imageFiles.val()) {
      alert("Please select some images to upload.");
      return;
    }

    // File upload is queued using $timeout in order to let $scope catch up
    // since this call was done outside the angular run loop.
    const files = imageFiles[0].files;
    $timeout(function () {
      $scope.startImageFilesUpload(files);
    }, 10);
  };

  $scope.refreshUploadProgress = function () {
    if (!$scope.filesUploadProgress || !$scope.filesUploadProgress.length) {
      $scope.uploadProgress = 0;
      return;
    }

    $scope.uploadProgress = ($scope.filesUploadProgress.reduce(function (previous, current) { return previous + current; }) / (1.0 * $scope.filesUploadProgress.length));
    if ($scope.uploadProgress >= 99.99) {
      $('#uploadDialog').modal('hide');
      $scope.isUploading = false;
      // $scope.loadImages();
    }
  }

  $scope.startImageFilesUpload = function (files) {
    $scope.isUploading = true;
    $scope.filesUploadProgress = Array.apply(null, Array(files.length)).map(Number.prototype.valueOf, 0.0);
    $scope.refreshUploadProgress();

    const projectId = $scope.project.projectId;
    for (var i = 0; i < files.length; i++) {
      const currentFile = files[i];
      const currentIndex = i;
      ProjectService.createTrainingImage(projectId).then(function (response) {
        const imageRecord = response.data.data.createTrainingImage;
        $scope.uploadImage(imageRecord, currentFile, currentIndex);
      }).catch(function (error) {
        console.log(error);
        $scope.error = error;
      });

    }
  };

  $scope.uploadImage = function (imageRecord, file, index) {
    const reader = new FileReader();
    reader.onload = function (event) {
      if (event.target.readyState != FileReader.DONE) {
        return;
      }

      const data = new Uint8Array(event.target.result);
      ProjectService.uploadImageToAzureStorageBlob(
        file.type,
        data,
        imageRecord.fileURL,
        function (error, result, status) {
          if (error) {
            $scope.error = error;
            alert(error);
            return;
          }

          ProjectService.commitTrainingImage(imageRecord.projectId, imageRecord.fileId).then(function (response) {
            const canonicalRecord = response.data.data.commitTrainingImage;
            $scope.filesUploadProgress[index] = 100;
            $scope.refreshUploadProgress();
            $scope.images.push(canonicalRecord);
          }).catch(function (error) {
            console.log("Got commit error:");
            console.log(error);
            $scope.error = error;
            console.log(error);
            alert(error);
          });
        },
        function (error) {
          console.log("Got upload error:");
          console.log(error);
          $scope.error = error;
          alert(error);
        },
        function (progressEvent) {
          if (!progressEvent.lengthComputable) {
            return;
          }
          if (!progressEvent.total) {
            return;
          }
          $scope.filesUploadProgress[index] = progressEvent.loaded / (1.0 * progressEvent.total);
        }
      );
    };
    reader.readAsArrayBuffer(file);
  };

  $scope.load();

});
