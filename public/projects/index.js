function loadProjects() {
  $.post("/v1/graphql/projects", { query: "query { getProjects{ projectId name } }" })
    .done(function (result) {
      const projects = result.data.getProjects;
      const $dropdown = $("#projectId");
      $.each(projects, function () {
        $dropdown.append($("<option />").val(this.projectId).text(this.name + " (" + this.projectId + ")"));
      });
    })
    .fail(function (error) {
      console.log("Unable to load projects.");
      console.log(error);
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
  const projectId = $("#projectId");
  $.post("/v1/graphql/projects", { query: `mutation { createImages(projectId: "${projectId.val()}", imageCount: ${files.length}) { imageId imageURL } }` })
    .done(function (result) {
      const images = result.data.createImages;
      $.each(images, function (index, currentImage) {
        const currentFile = files[index];
        const reader = new FileReader();
        reader.onload = function (event) {
          if (event.target.readyState == FileReader.DONE) {
            const data = new Uint8Array(event.target.result);
            $.ajax({
              url: currentImage.imageURL,
              type: "PUT",
              data: data,
              processData: false,
              beforeSend: function (xhr) {
                xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
                xhr.setRequestHeader('x-ms-blob-content-type', currentFile.type);
              },
              success: function (result, status) {
                $.post("/v1/graphql/projects", { query: `mutation { commitImages(images: [ { projectId: "${projectId.val()}", imageId: "${currentImage.imageId}" } ]) }` })
                  .done(function (result) {
                    if (result.errors) {
                      $("#errorModalBody").text(JSON.stringify(result.errors[0]));
                      $("#errorModal").modal("show");
                      // return;
                    }
                    console.log("Committed image successfully:");
                    console.log(currentImage);
                    console.log(result);
                  })
                  .fail(function (error) {
                    console.log("Got an error!");
                    console.log(error);
                  });
              },
              error: function (xhr, desc, error) {
                $("#errorModalBody").text("Unable to upload file.  " + error);
                $("#errorModal").modal("show");
              }
            })
          }
        };
        reader.readAsArrayBuffer(currentFile);
      });

    })
    .fail(function (error) {
      $("#errorModalBody").text(error);
      $("#errorModal").modal("show");
    });
}
