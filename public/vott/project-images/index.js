angular.module('vott.project-images', [
  'vott.factories'
]).controller('ProjectImagesController', function ($scope, $location, $route, $routeParams, ProjectService) {

  $scope.totalImageCount = 0;
  $scope.taggedImageCount = 0;
  $scope.conflictImageCount = 0;

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingImages = true;
  $scope.$watchGroup(['isLoadingProject', 'isLoadingImages'], function(newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingImages;
  });
  
  $scope.loadRecord = function () {

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

    $scope.isLoadingImages = true;
    ProjectService.images($routeParams.projectId)
      .then(function (response) {
        $scope.isLoadingImages = false;
        $scope.nextPageToken = response.data.data.images.nextPageToken;
        $scope.images = response.data.data.images.entries;
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.back = function () {
    const components = $location.path().split('/');
    components.pop();
    $location.path(components.join('/'));
  };

  $scope.upload = function() {
    console.log("Hello from upload");
  };

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
    const projectId = $scope.project.projectId;
    const files = imageFile[0].files;
    const file = files[0];
    ProjectService.createInstructionsImage(projectId).then(function (response) {
      const imageRecord = response.data.data.createInstructionsImage;
      $scope.uploadInstructionsImage(imageRecord, file);
    }).catch(function (error) {
      console.log(error);
      $scope.error = error;
    });
  };

  $scope.uploadInstructionsImage = function (imageRecord, file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      if (event.target.readyState != FileReader.DONE) {
        return;
      }

      const data = new Uint8Array(event.target.result);
      $scope.uploadImageToAzureStorageBlob(
        file.type,
        data,
        imageRecord.fileURL,
        function (error, result, status) {
          if (error) {
            $scope.error = error;
            return;
          }

          $('#uploadProgressBar').attr('value', 100);
          $('#uploadProgressBar').attr('max', 100);
          ProjectService.commitInstructionsImage(imageRecord).then(function (response) {
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
