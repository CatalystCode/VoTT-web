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
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');

const collaborationController = require('./src/collaboration');
const projectController = require('./src/project');

const blobService = azure.createBlobService();
const queueService = azure.createQueueService();
const tableService = azure.createTableService();
const services = {
  azure: azure,
  blobService: blobService,
  queueService: queueService,
  tableService: tableService
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

app.use(methodOverride());
app.use(cookieParser());
app.use(expressSession({ secret: 'keyboard gato', resave: true, saveUninitialized: false }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/v1/graphql/project', expressGraphql({
  schema: projectSchema,
  rootValue: projectController,
  graphiql: graphiqlEnabled,
}));

app.post('/.auth/login/microsoftaccount/callback',
  (request, response) => {
    console.log(`request.session ${JSON.stringify(request.session)}`);
    response.redirect("/project/");
  });
app.get('/logout', (request, response) => {
  if (!request.session) {
    response.redirect("/");
    return;
  }
  request.session.destroy((err) => {
    response.redirect("/");
  });
});

app.use(express.static('public'));
app.use('/v1/graphql/collaboration', expressGraphql({
  schema: collaborationSchema,
  rootValue: collaborationController,
  graphiql: graphiqlEnabled,
}));

app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`));
