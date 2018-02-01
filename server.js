require('dotenv').config();

const async = require("async");
const azure = require('azure-storage');
const express = require('express');
const expressGraphql = require('express-graphql');
const expressSession = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const graphiql = require('graphql');
const fs = require("fs");
// const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');

const modelService = require('./src/model-service');
const collaboratorService = require('./src/collaborator-service');
const inviteService = require('./src/invite-service');
const imageService = require('./src/image-service');
const projectService = require('./src/project-service');
const emailService = require('./src/email-service');

const jwt = require('./src/vott-jwt');
const foundation = require('./src/vott-foundation');

const services = {
  modelService: modelService.createModelService(),
  collaboratorService: collaboratorService.createCollaboratorService(),
  inviteService: inviteService.createInviteService(),
  imageService: imageService.createImageService(),
  projectService: projectService.createProjectService(),
  emailService: emailService.createEmailService(),
  tokenService: jwt.createTokenService(),

  blobService: azure.createBlobService(),
  queueService: azure.createQueueService(),
  tableService: azure.createTableService()
};

services.queueService.messageEncoder = new foundation.PassthroughEncoder();

const vottAdmin = new (require('./src/vott-admin')).RequestHandler();
const collaborationController = require('./src/collaboration');
[
  services.modelService,
  services.collaboratorService,
  services.inviteService,
  services.imageService,
  services.projectService,
  collaborationController,
  vottAdmin
].forEach(value => { value.setServices(services); })

const schemaFile = fs.readFileSync("src/schema.graphql", "utf8");

const collaborationSchemaFile = fs.readFileSync("src/collaboration.graphql", "utf8");
const collaborationSchema = graphiql.buildSchema(schemaFile + collaborationSchemaFile);

const vottAdminSchemaFile = fs.readFileSync("src/vott-admin.graphql", "utf8");
const vottAdminSchema = graphiql.buildSchema(schemaFile + vottAdminSchemaFile);

const graphiqlEnabled = process.env.GRAPHIQL_ENABLED == 'true';
const app = express();

app.use(methodOverride());
app.use(cookieParser());
app.use(expressSession({ secret: 'keyboard gato', resave: true, saveUninitialized: false }));
// app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/vott-admin', expressGraphql({
  schema: vottAdminSchema,
  rootValue: vottAdmin,
  graphiql: graphiqlEnabled,
  pretty: true
}));

app.use('/v1/graphql/collaboration', expressGraphql({
  schema: collaborationSchema,
  rootValue: collaborationController,
  graphiql: graphiqlEnabled,
  pretty: true
}));

app.get('/vott-training/projects/:projectId/:modelId/annotations.csv', (request, response) => {
  const projectId = request.params.projectId;
  const modelId = request.params.modelId;
  imageService.getTrainingImagesAnnotations(projectId).then(images => {
    response.set('Content-Type', 'text/plain; charset=utf8');
    response.set('Content-Disposition', 'attachment;filename=annotations.csv');
    var csv = '';
    for (var i = 0; i < images.length; i++) {
      const image = images[i];

      for (var annotationIndex = 0; annotationIndex < image.annotations.length; annotationIndex++) {
        const annotation = image.annotations[annotationIndex];
        csv += `${image.fileURL},${annotation.boundingBox.x},${annotation.boundingBox.y},${annotation.boundingBox.width},${annotation.boundingBox.height},${annotation.objectClassName}\n`;
      }
    }
    response.send(csv);
  }).catch(error => {
    console.log(error);
    response.send(error);
  });
});

app.get(
  '/v1/vott-training/invites/:projectId/:collaboratorId/:inviteId',
  (request, response) => {
    const projectId = request.params.projectId;
    const collaboratorId = request.params.collaboratorId;
    const inviteId = request.params.inviteId;
    services.inviteService.readInvite(projectId, collaboratorId, inviteId).then(invite => {
      const token = services.tokenService.sign({ projectId: projectId, collaboratorId: collaboratorId });
      response.status(200).send({ token: token });
    }).catch(error => {
      console.log(error);
      response.send(error);
    });
  }
);

app.use(express.static('public'));
app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`));
