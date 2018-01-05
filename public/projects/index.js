function getProjects(callback) {
  $.post(
    "/v1/graphql/projects",
    { query: "query { getProjects{ projectId name } }" }
  ).done(function (result) {
    if (result.errors) {
      return callback(result.errors, null);
    }
    callback(null, result.data.getProjects);
  }).fail(function (error) {
    callback(error);
  });
}

function createImages(projectId, files, callback) {
  $.post(
    "/v1/graphql/projects",
    {
      query: 'mutation CreateImages($projectId: String!, $imageCount: Int!) { createImages(projectId: $projectId, imageCount: $imageCount) { imageId imageURL } }',
      variables: {
        projectId: projectId,
        imageCount: files.length
      }
    }
  ).done(function (result) {
    if (result.errors) {
      return callback(result.errors, null);
    }
    callback(null, result.data.createImages);
  }).fail(function (error) {
    callback(error);
  });
}

function commitImages(images, callback) {
  $.post(
    "/v1/graphql/projects",
    {
      query: 'mutation CommitImages($images: [ConfirmedImage]!) { commitImages(images: $images) }',
      variables: {
        images: images
      }
    }
  ).done(function (result) {
    if (result.errors) {
      return callback(result.errors[0]);
    }
    callback(null, result.data.commitImages);
  }).fail(function (error) {
    callback(error);
  });
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

function loadProjects() {
  getProjects(function (error, projects) {
    if (error) {
      console.log("Unable to load projects.");
      console.log(error);
      return;
    }
    const dropdown = $("#projectId");
    dropdown.html("");
    $.each(projects, function () {
      dropdown.append($("<option />").val(this.projectId).text(this.name + " (" + this.projectId + ")"));
    });
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
          uploadImage(currentFile, data, currentImage.imageURL, function(error, result, status){
            if (error) {
              $("#errorModalBody").text("Unable to upload file.  " + error);
              $("#errorModal").modal("show");
              return;
            }

            console.log("Committed image successfully:");
            console.log(currentImage);
            console.log(result);
          });
        }
      };
      reader.readAsArrayBuffer(currentFile);
    });
  });
}
