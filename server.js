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

const imageContainerName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageQueueName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageTableName = process.env.IMAGE_TABLE_NAME || 'images';

async.series(
  [
    (callback) => { blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, callback); },
    (callback) => { queueService.createQueueIfNotExists(imageQueueName, callback); },
    (callback) => { tableService.createTableIfNotExists(imageTableName, callback); }
  ],
  (err, results) => {
    if (err) {
      console.error(err);
      return;
    }

    const services = {
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
    app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`))  
});
