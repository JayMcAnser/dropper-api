/*
 * interfaces with the / world
 */

const express = require('express');
const router = express.Router();
const CardController = require('../controllers/card')


// this should always be there to test if the api is running
router.get('/info', CardController.info);
router.post('/', CardController.create)
router.get('/', CardController.list)


module.exports = router;
