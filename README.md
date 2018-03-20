# VoTT-web
Visual Object Tagging Tool: A lightweight and collaborative tool for image tagging.

## Development Setup
First make sure you have a `.env` file created and that it includes the following key pairs:

```
PORT=8080
GRAPHIQL_ENABLED=true
WEBSITE_HOSTNAME='localhost'

AZURE_STORAGE_CONNECTION_STRING='somevaluefromazureportal'

SENDGRID_API_KEY='apikeyfromsendgrid'

VOTT_JWT_SECRET='somesecretkey'
VOTT_DEFAULT_ADMIN_EMAIL='your@emailaddress'
VOTT_DEFAULT_ADMIN_NAME='Administrator Display Name'
VOTT_INVITE_FROM_EMAIL='noreply@emailaddress'
VOTT_INVITE_FROM_NAME='Invite From Name'

PG_HOST='mydb.postgres.server.host'
PG_USER='adminusername@mydb'
PG_PASSWORD='somepassword'
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
