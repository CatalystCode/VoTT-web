angular.module('vott.project-tasks', [
  'vott.factories'
]).controller('ProjectTasksController', function ($scope, $location, $route, $routeParams, $timeout, ProjectService) {

  $scope.isLoading = true;
  $scope.isLoadingProject = true;
  $scope.isLoadingTask = true;

  $scope.createTag = function (currentLabel) {
    return {
      label: currentLabel,
      boundingBox: {}
    };
  };

  $scope.tags = [];
  $scope.currentTag = $scope.createTag();

  $scope.$watchGroup(['isLoadingProject', 'isLoadingTask'], function (newValues, oldValues, scope) {
    $scope.isLoading = $scope.isLoadingProject || $scope.isLoadingTask;
  });

  $scope.load = function () {
    $scope.loadProject();
    $scope.loadTask();
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

  $scope.loadTask = function () {
    $scope.isLoadingTask = true;
    ProjectService.pullTask($routeParams.projectId)
      .then(function (response) {
        $scope.setTask(response.data);
        $scope.isLoadingTask = false;
      })
      .catch(function (error) {
        if (error.status == 404) {
          $scope.setTask(null);
          $scope.isLoadingTask = false;
          return;
        }
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.setTask = function (task) {
    $scope.task = task;
    $scope.tags = [];
    $scope.taskImage = new Image();
    if (!task || !task.imageURL) {
      return;
    }
    $scope.taskImage.src = task.imageURL;
    $scope.taskImage.onload = function () {
      $timeout(function () {
        $scope.clearCanvas();
      }, 0);
    };
  };

  $scope.clearCanvas = function () {
    const canvas = document.getElementById('taskCanvas');
    const context = canvas.getContext('2d');
    const image = $scope.taskImage;
    context.clearRect(0, 0, canvas.width, canvas.height);
    $scope.drawImage();
  };

  $scope.eventCoordinates = function (event) {
    var offset = event.target.getBoundingClientRect();
    return {
      x: event.pageX - offset.left,
      y: event.pageY - offset.top,
    };
  };

  $scope.clamp = function (number, min, max) {
    return (number <= min) ? min : (number >= max) ? max : number;
  };

  $scope.imageEventCoordinates = function (event) {
    const canvasCoordinates = $scope.eventCoordinates(event);
    const canvas = document.getElementById('taskCanvas');
    const imageBoundingBox = $scope.imageBoundingBox($scope.taskImage, canvas);
    const imageCanvasScale = $scope.imageScale($scope.taskImage, canvas);
    const canvasImageScale = 1.0 / (imageCanvasScale * 1.0);
    const imageCoordinates = {
      x: $scope.clamp(canvasCoordinates.x, 0, imageBoundingBox.width) * canvasImageScale,
      y: $scope.clamp(canvasCoordinates.y, 0, imageBoundingBox.height) * canvasImageScale
    };
    return imageCoordinates;
  };

  $scope.onmousedown = function (event) {
    const coordinates = $scope.imageEventCoordinates(event);
    const currentLabel = $scope.currentTag.label;
    $scope.captureInProgress = true;
    $scope.currentTag = $scope.createTag(currentLabel);
    $scope.currentTag.boundingBox.x1 = coordinates.x;
    $scope.currentTag.boundingBox.y1 = coordinates.y;
  };

  $scope.onmousemove = function (event) {
    if (!$scope.captureInProgress) {
      return;
    }
    const coordinates = $scope.imageEventCoordinates(event);
    $scope.currentTag.boundingBox.x2 = coordinates.x;
    $scope.currentTag.boundingBox.y2 = coordinates.y;
    $scope.updateTag($scope.currentTag);
    $scope.drawTags();
  };

  $scope.onmouseup = function (event) {
    if (!$scope.captureInProgress) {
      return;
    }
    const coordinates = $scope.imageEventCoordinates(event);
    $scope.captureInProgress = false;
    $scope.currentTag.boundingBox.x2 = coordinates.x;
    $scope.currentTag.boundingBox.y2 = coordinates.y;
    $scope.commitCurrentTag();
    $scope.drawTags();
  };

  $scope.onmouseout = function (event) {
    if (!$scope.captureInProgress) {
      return;
    }
    $scope.captureInProgress = false;
    $scope.commitCurrentTag();
    $scope.drawTags();
  };

  $scope.updateTag = function (tag) {
    tag.boundingBox.x = tag.boundingBox.x1;
    tag.boundingBox.y = tag.boundingBox.y1;
    tag.boundingBox.width = tag.boundingBox.x2 - tag.boundingBox.x1;
    tag.boundingBox.height = tag.boundingBox.y2 - tag.boundingBox.y1;
  };

  $scope.commitCurrentTag = function () {
    $scope.updateTag($scope.currentTag);
    $scope.tags.push($scope.currentTag);
  };

  $scope.imageScale = function (image, canvas) {
    return Math.min(canvas.width / image.width, canvas.height / image.height);
  };

  $scope.imageBoundingBox = function (image, canvas) {
    const scale = $scope.imageScale(image, canvas);
    return {
      x: 0,
      y: 0,
      width: image.width * scale,
      height: image.height * scale
    };
  };

  $scope.drawImage = function () {
    const image = $scope.taskImage;
    if (image.width == 0 || image.height == 0) {
      return;
    }

    const canvas = document.getElementById('taskCanvas');
    const context = canvas.getContext('2d');
    const imageBoundingBox = $scope.imageBoundingBox(image, canvas);
    context.drawImage(image, imageBoundingBox.x, imageBoundingBox.y, imageBoundingBox.width, imageBoundingBox.height);
  };

  $scope.drawTags = function () {
    const canvas = document.getElementById('taskCanvas');
    const context = canvas.getContext('2d');
    context.lineWidth = 2;
    context.strokeStyle = 'red';

    // TODO: Don't redraw the image on each redraw. Consider moving that to a separate layer.
    context.clearRect(0, 0, canvas.width, canvas.height);
    $scope.drawImage();

    const imageCanvasScale = $scope.imageScale($scope.taskImage, canvas);
    for (var i = 0; i < $scope.tags.length; i++) {
      $scope.drawTag(context, $scope.tags[i], imageCanvasScale);
    }

    if ($scope.currentTag) {
      $scope.drawTag(context, $scope.currentTag, imageCanvasScale);
    }
  };

  $scope.drawTag = function (context, tag, imageCanvasScale) {
    context.save();
    context.scale(imageCanvasScale, imageCanvasScale);
    context.strokeRect(
      tag.boundingBox.x,
      tag.boundingBox.y,
      tag.boundingBox.width,
      tag.boundingBox.height
    );
    context.restore();
  };

  $scope.cancel = function () {
    $scope.tags = [];
    $scope.drawTags();
  };

  $scope.save = function () {
    $scope.task.tags = $scope.tags;
    ProjectService.pushTask($routeParams.projectId, $scope.task)
      .then(function (response) {
        $scope.loadTask();
      })
      .catch(function (error) {
        console.log(error);
        $scope.error = error;
      });
  };

  $scope.details = function () {
    $location.path(`/projects/${$routeParams.projectId}`);
  };

  $scope.manageImages = function () {
    $location.path(`/projects/${$routeParams.projectId}/images`);
  };

  $scope.manageCollaborators = function () {
    $location.path(`/projects/${$routeParams.projectId}/collaborators`);
  };

  $scope.manageModels = function () {
    $location.path(`/projects/${$routeParams.projectId}/models`);
  };

  $scope.manageTasks = function () {
    $location.load();
  };

  $scope.load();

});
