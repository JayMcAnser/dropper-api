/*
 * interfaces with the / world
 */

const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public');

router.get('/', )
router.get('/list', publicController.list);
router.get('/open/:name', publicController.open);
router.get('/openById/:id', publicController.openById);
router.get('/image/:id/:imageId', publicController.imageGet);


module.exports = router;
