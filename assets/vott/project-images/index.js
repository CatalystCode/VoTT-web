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
  $scope.isLoadingStats = true;
  $scope.$watchGroup(
    ['isLoadingProject', 'isLoadingImages', 'isLoadingStats'],
    function (newValues, oldValues, scope) {
      $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingImages || $scope.isLoadingStats;
    }
  );

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadImages();
    $scope.loadStats();
  };

  $scope.loadProject = function () {
    $scope.isLoadingProject = true;
    ProjectService.getProject($routeParams.projectId)
      .then(function (response) {
        $scope.project = response.data;
        $scope.isLoadingProject = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.loadImages = function (skip, limit) {
    $scope.isLoadingImages = true;
    const requestedSkip = skip;
    ProjectService.trainingImages($routeParams.projectId, skip, limit)
      .then(function (response) {
        const serviceData = response.data;
        $scope.isLoadingImages = false;
        $scope.total = serviceData.total;
        $scope.skip = serviceData.skip;
        $scope.limit = serviceData.limit;
        if (requestedSkip) {
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

  $scope.loadStats = function () {
    $scope.isLoadingStats = true;
    ProjectService.trainingImageStats($routeParams.projectId)
      .then(function (response) {
        const stats = response.data;
        $scope.stats = stats;
        $scope.isLoadingStats = false;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  }

  $scope.details = function () {
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
    $('#uploadDialog').modal({
      backdrop: 'static',
      keyboard: false
    });
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

    const projectId = $scope.project.id;
    for (var i = 0; i < files.length; i++) {
      const currentFile = files[i];
      const currentIndex = i;
      ProjectService.createTrainingImage(projectId).then(function (response) {
        const imageRecord = response.data;
        $scope.uploadImage(imageRecord, currentFile, currentIndex);
      }).catch(function (error) {
        console.log(error);
        $scope.error = error;
      });

    }
  };

  $scope.uploadImage = function (imageRecord, file, index) {
    const projectId = $routeParams.projectId;
    imageRecord.name = file.name;
    const reader = new FileReader();
    reader.onload = function (event) {
      if (event.target.readyState != FileReader.DONE) {
        return;
      }

      const data = new Uint8Array(event.target.result);
      ProjectService.uploadImageToAzureStorageBlob(
        file.type,
        data,
        imageRecord.url,
        function (error, result, status) {
          if (error) {
            $scope.error = error;
            console.log("Unable to upload to:");
            console.log(imageRecord.url);
            console.log(error);
            return;
          }

          ProjectService.commitTrainingImage(imageRecord).then(function (response) {
            const canonicalRecord = response.data;
            $scope.filesUploadProgress[index] = 100;
            $scope.refreshUploadProgress();
            $scope.setNeedsLoadImages();
          }).catch(function (error) {
            $scope.error = error;
            console.log("Got commit error:");
            console.log(error);
            console.log(error);
          });
        },
        function (error) {
          $scope.error = error;
          console.log("Got upload error:");
          console.log(error);
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

  $scope.setNeedsLoadImages = function () {
    $scope.needsLoadImages = true;
    setTimeout(function () {
      if ($scope.needsLoadImages) {
        $scope.needsLoadImages = false;
        $scope.loadImages();
        $scope.loadStats();
      }
    }, 500);
  };

  $scope.hasMore = function () {
    const pageCount = Math.ceil($scope.total / $scope.limit);
    const currentPage = Math.ceil($scope.skip / $scope.limit);
    return currentPage < pageCount;
  }

  $scope.loadMore = function () {
    $scope.loadImages($scope.skip + $scope.limit, $scope.limit);
  }

  $scope.load();

});
