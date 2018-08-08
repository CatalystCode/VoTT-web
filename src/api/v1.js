const connect_ensure_login = require('connect-ensure-login');
const express = require('express');

const project = require('./project');

const router = new express.Router();
const projectController = new project.ProjectController(null);

// TODO: Enforce policies.
router.get('/projects', (req, res)=>{ projectController.list(req, res); });
router.post('/projects', (req, res)=>{ projectController.create(req, res); });
router.get('/projects/:projectId', connect_ensure_login.ensureLoggedIn(), (req, res)=>{ projectController.read(req, res); });
router.put('/projects/:projectId', connect_ensure_login.ensureLoggedIn(), (req, res)=>{ projectController.update(req, res); });
router.delete('/projects/:projectId', (req, res)=>{ projectController.delete(req, res); });

module.exports = router;
