const projectsGraphqlBasePath = '/v1/graphql/projects';
function getProjects(callback) {
  $.post(
    projectsGraphqlBasePath,
    { query: "query { getProjects{ projectId name taskType objectClassNames instructionsText } }" }
  ).done(function (result) {
    if (result.errors) {
      return callback(result.errors, null);
    }
    callback(null, result.data.getProjects);
  }).fail(function (error) {
    callback(error);
  });
}

function getImages(projectId, callback) {
  $.post(
    projectsGraphqlBasePath,
    {
      query: 'query { getImages(projectId: "+JSON.stringify(projectId)+"){ pageToken images {imageId imageURL} } }'
      }
  ).done(function (result) {
    if (result.errors) {
      return callback(result.errors, null);
    }
    callback(null, result.data.getImages);
  }).fail(function (error) {
    callback(error);
  });
}

function createImages(projectId, files, callback) {
  $.post(
    projectsGraphqlBasePath,
    {
      query: 'mutation { createImages(projectId: '+JSON.stringify(projectId)+', imageCount: '+JSON.stringify(files.length)+') { projectId imageId imageURL } }'
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
  // {
  //   query: 'mutation CommitImages($images: [ConfirmedImage]!) { commitImages(images: $images) }',
  //   variables: {
  //     '$images': images
  //   }
  // }

  // TODO: Make variable substition work again.
  var escapedImages = images.map(function(value){
    return '{ projectId: ' + JSON.stringify(value.projectId) + ', imageId: ' + JSON.stringify(value.imageId) + ' } ';
  });
  $.post(
    projectsGraphqlBasePath,
    {
      query: 'mutation { commitImages(images: ['+escapedImages.join()+'] ) }'
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

    const tableBody = $("#projectsTable tbody")[0];
    console.log(tableBody);

    const dropdown = $("#projectId");
    dropdown.html("");
    $.each(projects, function () {
      const projectId = this.projectId;
      dropdown.append($("<option />").val(projectId).text(this.name + " (" + projectId + ")"));
      console.log("Fetching images for: " + projectId);

      const row = document.createElement("tr");
      tableBody.append(row);

      const projectIdCell = document.createElement("th");
      projectIdCell.setAttribute("scope", "row");
      projectIdCell.innerText = projectId;
      row.appendChild(projectIdCell);

      const projectNameCell = document.createElement("td");
      projectNameCell.innerText = this.name;
      row.appendChild(projectNameCell);

      const projectTaskTypeCell = document.createElement("td");
      projectTaskTypeCell.innerText = this.taskType;
      row.appendChild(projectTaskTypeCell);

      const editCell = document.createElement("td");
      const editLink = document.createElement("a");
      editLink.href = document.location + projectId;
      editLink.innerText = "Edit";
      editCell.appendChild(editLink);
      row.appendChild(editCell);

      getImages(projectId, function(error, imageList){
        if (error) {
          console.log("Unable to fetch images:");
          console.log(error);
          return;
        }
        console.log("imageList:");
        console.log(imageList);
      });
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
              console.log(error);
              return;
            }

            commitImages([currentImage], function(error, result){
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
