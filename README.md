# VoTT-web
Visual Object Tagging Tool: A lightweight and collaborative tool for image tagging.

# Development Setup
First make sure you have a `.env` file created and that it includes the following key pairs:

```
PORT=8080
GRAPHIQL_ENABLED=true
AZURE_STORAGE_CONNECTION_STRING=somevaluefromazureportal
VOTT_JWT_SECRET=somesecretkey
SENDGRID_API_KEY=apikeyfromsendgrid
```

Then you can run one of the following:

```
docker-compose up
```

```
npm start
```

