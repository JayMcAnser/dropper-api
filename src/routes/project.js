/**
 * access to the project
 */

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project');

router.get('/list', projectController.list)
router.post('/', projectController.create)

module.exports = router;
