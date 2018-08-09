# VoTT-web
Visual Object Tagging Tool: A lightweight and collaborative tool for image tagging.

## Development Setup
First make sure you have a `.env` file created and that it includes the following key pairs:

```
PORT=8080

AZURE_STORAGE_CONNECTION_STRING=
GITHUB_CLIENT=
GITHUB_SECRET=

VOTT_DEFAULT_ADMIN_GITHUB_USER=
VOTT_DEFAULT_ADMIN_NAME='Luke Skywalker'
```

Then you can run either

```
docker-compose up
```

or

```
npm install
npm start
```

## Deploy to Azure
Click this button to deploy web app, storage, and PostgreSQL resources to Azure. 

[![Deploy to Azure](https://azuredeploy.net/deploybutton.svg)](https://azuredeploy.net/)
