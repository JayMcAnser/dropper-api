/*
 * interfaces with the / world
 */

const express = require('express');
const router = express.Router();
const testController = require('../controllers/test');
const Auth = require('../controllers/auth')

// this should always be there to test if the api is running
router.get('/', testController.index);

if (process.env.NODE_ENV === 'develop' || process.env.NODE_ENV === 'test') {
  console.log('setting update develope test definition')
  router.get('/noauth', testController.noAuth);
  router.get('/auth/getInfo', testController.authGetInfo)
  router.get('/auth/dataValidation', testController.authDataValidationError)
}

module.exports = router;
