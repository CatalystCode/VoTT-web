function ProjectDAO() {
  this.projectsGraphqlBasePath = '/v1/graphql/projects';
}

/**
 * Calls the graphql query projects(nextPageToken:String): ProjectList
 * @param {string} nextPageToken (optional).
 */
ProjectDAO.prototype.getProjects = function(nextPageToken) {
  const query = nextPageToken ? `projects(nextPageToken:${JSON.stringify(nextPageToken)})` : 'projects';
  return $.post(
    this.projectsGraphqlBasePath,
    { query: "query { "+query+"{ nextPageToken entries { projectId name taskType objectClassNames instructionsText } } }" }
  );
};

/**
 * Calls createProject(name: String!, taskType: TaskType!, objectClassNames:[String]!, instructionsText:String, instructionsImageURL:String, instructionsVideoURL:String):Project
 * @param {object} project whose properties include the values passed to the createProject function.
 */
ProjectDAO.prototype.createProject = function (project) {
  const parameters = [
    `name:${JSON.stringify(project.name)}`,
    `taskType:${project.taskType}`,
    `objectClassNames:${JSON.stringify(project.objectClassNames)}`,
    `instructionsText:${JSON.stringify(project.instructionsText)}`
  ].join(', ');
  const query = `mutation { createProject (${parameters}) { projectId } }`;
  return $.post(
    this.projectsGraphqlBasePath,
    { query: query }
  );
}

/**
 * Calls graphql mutation removeProject(projectId: String!):String
 * @param {string} projectId that represents the project to be removed.
 */
ProjectDAO.prototype.removeProject = function (projectId) {
  return $.post(
    this.projectsGraphqlBasePath,
    { query: `mutation { removeProject (projectId:${JSON.stringify(projectId)}) }` }
  );
}
