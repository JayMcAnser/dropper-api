/**
 * access to the boards
 */
/**
 * access to the api
 */

const express = require('express');
const router = express.Router();
const boardController = require('../controllers/board');

router.get('/:name', boardController.open);
router.post('/', boardController.create);
router.put('', boardController.replace);


module.exports = router;
