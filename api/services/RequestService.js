module.exports = {
  extractProjectId: function (req) {
    if (req.body && req.body.projectId) {
      return req.body.projectId;
    }

    if (req.params && req.params.projectId) {
      return req.params.projectId;
    }

    if (req.query && req.query.projectId) {
      return req.query.projectId;
    }

    return null;
  }
};
