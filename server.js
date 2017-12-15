require('dotenv').config()

const express = require('express');
const helmet = require('helmet');
const azure = require('azure-storage');

const tableService = azure.createTableService();
const blobService = azure.createBlobService();

const imageTableName = process.env.IMAGE_TABLE_NAME || 'images';
const imageContainerName = process.env.IMAGE_CONTAINER_NAME || 'images';

tableService.createTableIfNotExists(imageTableName, (error, result, response) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(result ? `Created table ${imageTableName}`:`Table ${imageTableName} already exists.`);

  blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, (error, result, response) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log(result ? `Created container ${imageContainerName}`:`Container ${imageContainerName} already exists.`);

    const app = express();
    app.use(helmet());
    app.get('/', (req, res) => res.send('Welcome to VoTT!'))
    app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`))  
  });
  
});
