require('dotenv').config()

const async = require("async");
const azure = require('azure-storage');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const helmet = require('helmet');
const graphiql = require('graphql');
const fs = require("fs");

const collaborationController = require('./src/collaboration');
const projectController = require('./src/project');

const blobService = azure.createBlobService();
const queueService = azure.createQueueService();
const tableService = azure.createTableService();
const services = {
  azure:azure,
  blobService:blobService,
  queueService:queueService,
  tableService:tableService  
};

collaborationController.setConfiguration(services);
projectController.setConfiguration(services);

const schemaFile = fs.readFileSync("src/schema.graphql", "utf8");

const collaborationSchemaFile = fs.readFileSync("src/collaboration.graphql", "utf8");
const collaborationSchema = graphiql.buildSchema(schemaFile + collaborationSchemaFile);

const projectSchemaFile = fs.readFileSync("src/project.graphql", "utf8");
const projectSchema = graphiql.buildSchema(schemaFile + projectSchemaFile);

const graphiqlEnabled = process.env.GRAPHIQL_ENABLED == 'true';
const app = express();
app.use(helmet());
app.use(express.static('web'))
app.use('/v1/graphql/collaboration', graphqlHTTP({
  schema: collaborationSchema,
  rootValue: collaborationController,
  graphiql: graphiqlEnabled,
}));
app.use('/v1/graphql/project', graphqlHTTP({
  schema: projectSchema,
  rootValue: projectController,
  graphiql: graphiqlEnabled,
}));

app.get('/projects/', function (req, res) {
  res.sendFile('project.html', {"root": __dirname + "/web"});
});
app.get('/projects/:projectId', function (req, res) {
  res.sendFile('project.html', {"root": __dirname + "/web"});
});
app.get('/tasks/:taskId', function (req, res) {
  res.sendFile('task.html', {"root": __dirname + "/web"});
});

app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`));
