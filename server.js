require('dotenv').config();

const async = require("async");
const azure = require('azure-storage');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const expressSession = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const graphiql = require('graphql');
const fs = require("fs");
// const passport = require('passport');
// const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');

const collaborationController = require('./src/collaboration');
const projectController = require('./src/project');

// const usersByOID = {};

// passport.serializeUser((user, done) => {
//   console.log("Serializing user.");
//   // console.log(user);
//   usersByOID[user.oid] = user;
//   done(null, user.oid);
// });

// passport.deserializeUser((oid, done) => {
//   console.log("Deserializing user:");
//   console.log(oid);
//   done(null, usersByOID[oid]);
// });

// passport.use(
//   new OIDCStrategy(
//     {
//       clientID: process.env.MICROSOFT_APPLICATION_ID,
//       redirectUrl: process.env.MICROSOFT_APPLICATION_REDIRECT_URL,
//       clientSecret: process.env.MICROSOFT_APPLICATION_SECRET,
//       identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
//       responseType: 'code id_token',
//       responseMode: 'form_post',
//       allowHttpForRedirectUrl: true,
//       validateIssuer: false,
//       isB2C: false,
//       policyName: null,
//       issuer: null,
//       passReqToCallback: false,
//       scope: ['profile', 'offline_access'],
//       loggingLevel: 'error',
//       nonceLifetime: null,
//       nonceMaxAmount: 5,
//       useCookieInsteadOfSession: true,
//       cookieEncryptionKeys: [
//         { 'key': '12345678901234567890123456789012', 'iv': '123456789012' },
//         { 'key': 'abcdefghijklmnopqrstuvwxyzabcdef', 'iv': 'abcdefghijkl' }
//       ],
//       clockSkew: null,
//     },
//     (iss, sub, profile, accessToken, refreshToken, done) => {
//       if (!profile.oid) {
//         console.log("No oid found.");
//         return done(new Error("No oid found"), null);
//       }
//       console.log("Performing verification...");
//       const existingUser = usersByOID[profile.oid];
//       if (existingUser) {
//         done(null, existingUser);
//       }
//       usersByOID[profile.oid] = profile;
//       done(null, profile);
//     }
//   )
// );

// function isAuthenticated(request) {
//   if (!request) {
//     return false;
//   }
//   if (!request.session) {
//     return false;
//   }
//   if (!request.session.passport) {
//     return false;
//   }
//   return request.session.passport.user;
// }

// function ensureAuthenticated(request, response, next) {
//   console.log("Hello from ensureAuthenticated.");
//   console.log(request.session);
//   if (isAuthenticated(request)) {
//     console.log("Is authenticated.");
//     return next();
//   }
//   console.log("Not authenticated.");
//   passport.authenticate('azuread-openidconnect', { response: response, /*successRedirect: request.url,*/ failureRedirect: '/auth-error' })(request, response, next);
// };

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
// app.use(passport.initialize());
// app.use(passport.session());
// app.use(helmet());
app.use(methodOverride());
app.use(cookieParser());
app.use(expressSession({ secret: 'keyboard gato', resave: true, saveUninitialized: false }));
app.use(bodyParser.urlencoded({ extended: true }));

// app.get('/project/', ensureAuthenticated);
// app.get('/project/', express.static('public/project'));
app.use('/v1/graphql/project', graphqlHTTP({
  schema: projectSchema,
  rootValue: projectController,
  graphiql: graphiqlEnabled,
}));
app.post('/.auth/login/microsoftaccount/callback',
  // (request, response, next) => {
  //   passport.authenticate('azuread-openidconnect', { response: response, failureRedirect: '/auth-error' })(request, response, next);
  // },
  (request, response) => {
    response.redirect("/project/");
  });
app.get('/logout', (request, response) => {
  if (!request.session) {
    request.logOut();
    response.redirect("/");
    return;
  }
  request.session.destroy((err) => {
    request.logOut();
    response.redirect("/");
  });
});

app.use(express.static('public'));
app.use('/v1/graphql/collaboration', graphqlHTTP({
  schema: collaborationSchema,
  rootValue: collaborationController,
  graphiql: graphiqlEnabled,
}));

app.listen(process.env.PORT, () => console.log(`Started on port ${process.env.PORT}`));
