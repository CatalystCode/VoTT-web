process.chdir(__dirname);

require('dotenv').config();

const PORT = process.env.PORT || 8080;

const azureStorage = require('azure-storage');
const bodyParser = require('body-parser');
const connect_ensure_login = require('connect-ensure-login');
const cookieParser = require('cookie-parser');
const express = require('express');
const expressSession = require('express-session');
const passport = require('passport');
const passportGithub = require('passport-github');
const path = require('path');

const blobServiceConnectionString = process.env.BLOB_SERVICE_CONNECTION_STRING;
const blobService = azureStorage.createBlobService(blobServiceConnectionString);

const tableServiceConnectionString = process.env.TABLE_SERVICE_CONNECTION_STRING;
const tableService = azureStorage.createTableService(tableServiceConnectionString);

const queueServiceConnectionString = process.env.QUEUE_SERVICE_CONNECTION_STRING;
const queueService = azureStorage.createQueueService(queueServiceConnectionString);

passport.use(new passportGithub.Strategy(
  {
    clientID: process.env.GITHUB_CLIENT,
    clientSecret: process.env.GITHUB_SECRET,
    callbackURL: "http://localhost:8080/auth/github/callback"
  },
  (accessToken, refreshToken, profile, cb) => {
    return cb(null, profile);
  }
));
passport.serializeUser((user, done) => {
  /**
   * Github replies with something like:
   * {
   *   "id":"1117904",
   *   "displayName":"Juan Carlos Jimenez",
   *   "username":"jcjimenez",
   *   "provider":"github",
   *   ...
   * }
   */
  done(null, JSON.stringify(user));
});
passport.deserializeUser((user, done) => {
  done(null, JSON.parse(user));
});

const app = express();
app.use(cookieParser());
app.use(expressSession({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', passport.authenticate('github'));
app.get('/vott', connect_ensure_login.ensureLoggedIn(), (req, res, next) => {
  next();
});
app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

// TODO: Enforce policies.
const router = new express.Router();

const projectService = new (require('./src/model/project-service').ProjectService)(blobService, tableService, queueService);
const projectController = new (require('./src/api/project-controller')).ProjectController(projectService);
router.get('/projects', (req, res) => { projectController.list(req, res); });
router.post('/projects', (req, res) => { projectController.create(req, res); });
router.get('/projects/:id', (req, res) => { projectController.read(req, res); });
router.put('/projects/:id', (req, res) => { projectController.update(req, res); });
router.delete('/projects/:id', (req, res) => { projectController.delete(req, res); });
router.get('/projects/:projectId/images/:imageId', (req, res) => { projectController.image(req, res); });
router.post('/projects/:id/instructionsImage', (req, res) => { projectController.allocateInstructionsImage(req, res); });
router.put('/projects/:id/instructionsImage', (req, res) => { projectController.commitInstructionsImage(req, res); });

const trainingImageService = new (require('./src/model/training-image-service').TrainingImageService)(blobService, tableService, queueService, projectService);
const trainingImageController = new (require('./src/api/training-image-controller')).TrainingImageController(trainingImageService);
router.get('/trainingImages', (req, res, next) => { trainingImageController.list(req, res, next); });
router.post('/trainingImages', (req, res, next) => { trainingImageController.allocate(req, res, next); });
router.put('/trainingImages/:id', (req, res, next) => { trainingImageController.create(req, res, next); });
router.get('/trainingImages/stats', (req, res, next) => { trainingImageController.stats(req, res, next); });

const accessRightsService = new (require('./src/model/access-rights-service').AccessRightsService)(tableService);
const accessRightsController = new (require('./src/api/access-rights-controller')).AccessRightsController(accessRightsService);
router.get('/accessRights', (req, res, next) => { accessRightsController.list(req, res, next); });
router.post('/accessRights', (req, res, next) => { accessRightsController.create(req, res, next); });
router.delete('/accessRights/:id', (req, res, next) => { accessRightsController.delete(req, res, next); });

app.use('/api/vott/v1', router);

app.use(require('serve-static')(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Listening on port ${PORT}.`));
