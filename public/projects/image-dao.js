function ImageDAO () {
  this.projectsGraphqlBasePath = '/v1/graphql/projects';
}

ImageDAO.prototype.getImages = function (projectId) {
  return $.post(
    this.projectsGraphqlBasePath,
    {
      query: 'query { images(projectId: '+JSON.stringify(projectId)+'){ nextPageToken images {imageId imageURL} } }'
    }
  );
}

ImageDAO.prototype.createImages = function (projectId, files, callback) {
  return $.post(
    this.projectsGraphqlBasePath,
    {
      query: 'mutation { createImages(projectId: ' + JSON.stringify(projectId) + ', imageCount: ' + JSON.stringify(files.length) + ') { projectId imageId imageURL } }'
    }
  );
}

ImageDAO.prototype.commitImages = function (images, callback) {
  // {
  //   query: 'mutation CommitImages($images: [ConfirmedImage]!) { commitImages(images: $images) }',
  //   variables: {
  //     '$images': images
  //   }
  // }

  // TODO: Make variable substition work again.
  var escapedImages = images.map(function (value) {
    return '{ projectId: ' + JSON.stringify(value.projectId) + ', imageId: ' + JSON.stringify(value.imageId) + ' } ';
  });
  return $.post(
    this.projectsGraphqlBasePath,
    {
      query: 'mutation { commitImages(images: [' + escapedImages.join() + '] ) }'
    }
  );
}

// TODO: Support progress updates.
function uploadImage(imageFile, imageData, imageURL, callback) {
  $.ajax({
    url: imageURL,
    type: "PUT",
    data: imageData,
    processData: false,
    beforeSend: function (xhr) {
      xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
      xhr.setRequestHeader('x-ms-blob-content-type', imageFile.type);
    },
    success: function (result, status) {
      callback(null, result, status);
    },
    error: function (xhr, desc, error) {
      callback(error, xhr, desc);
    }
  });
}

function submitProjectForm(event) {
  event.preventDefault();
  const imageFile = $("#imageFile");
  if (!imageFile.val()) {
    $("#errorModalBody").text("Please select an image to upload.");
    $("#errorModal").modal("show");
    return;
  }

  const files = imageFile[0].files;
  const projectId = $("#projectId").val();
  createImages(projectId, files, function (error, images) {
    if (error) {
      $("#errorModalBody").text(error);
      $("#errorModal").modal("show");
      return;
    }

    $.each(images, function (index, currentImage) {
      const currentFile = files[index];
      const reader = new FileReader();
      reader.onload = function (event) {
        if (event.target.readyState == FileReader.DONE) {
          const data = new Uint8Array(event.target.result);
          uploadImage(currentFile, data, currentImage.imageURL, function (error, result, status) {
            if (error) {
              $("#errorModalBody").text("Unable to upload file.  " + error);
              $("#errorModal").modal("show");
              console.log(error);
              return;
            }

            commitImages([currentImage], function (error, result) {
              if (error) {
                $("#errorModalBody").text("Unable to commit file.  " + error);
                $("#errorModal").modal("show");
                console.log(error);
                return;
              }

              console.log("Committed image successfully:");
              console.log(currentImage);
              console.log(result);
            });
          });
        }
      };
      reader.readAsArrayBuffer(currentFile);
    });
  });
}
