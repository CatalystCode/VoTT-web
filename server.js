require('dotenv').config();

const async = require("async");
const azure = require('azure-storage');
const cors = require('cors');
const express = require('express');
const expressGraphql = require('express-graphql');
const expressSession = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const graphiql = require('graphql');
const fs = require("fs");
// const bodyParser = require("body-parser");
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

collaborationController.setServices(services);
projectController.setServices(services);

const schemaFile = fs.readFileSync("src/schema.graphql", "utf8");

const collaborationSchemaFile = fs.readFileSync("src/collaboration.graphql", "utf8");
const collaborationSchema = graphiql.buildSchema(schemaFile + collaborationSchemaFile);

const projectSchemaFile = fs.readFileSync("src/project.graphql", "utf8");
const projectSchema = graphiql.buildSchema(schemaFile + projectSchemaFile);

const graphiqlEnabled = process.env.GRAPHIQL_ENABLED == 'true';
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080,https://popspotsvott01.azurewebsites.net').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if(!origin) return callback(null, true);

    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));
app.use(methodOverride());
app.use(cookieParser());
app.use(expressSession({ secret: 'keyboard gato', resave: true, saveUninitialized: false }));
// app.use(bodyParser.urlencoded({ extended: true }));

app.use('/v1/graphql/projects', expressGraphql({
  schema: projectSchema,
  rootValue: projectController,
  graphiql: graphiqlEnabled,
  pretty: true
}));

app.use('/v1/graphql/collaboration', expressGraphql({
  schema: collaborationSchema,
  rootValue: collaborationController,
  graphiql: graphiqlEnabled,
  pretty: true
}));  

app.use(express.static('public'));
app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`));
