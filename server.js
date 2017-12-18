require('dotenv').config()

const async = require("async");
const azure = require('azure-storage');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const helmet = require('helmet');
const { buildSchema } = require('graphql');
const fs = require("fs");

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
  
    const schemaFile = fs.readFileSync("schema.graphql", "utf8");
    const schema = buildSchema(schemaFile);
    const graphiqlEnabled = process.env.GRAPHIQL_ENABLED == 'true';
    const app = express();
    app.use(helmet());
    app.use(express.static('web'))
    app.use('/v1/graphql', graphqlHTTP({
      schema: schema,
      rootValue: {
        hello: () => {
          return 'Hello world!';
        },
      },
      graphiql: graphiqlEnabled,
    }));
    app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`))  
});
