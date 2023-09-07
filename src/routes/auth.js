/**
 * access to the api
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

router.post('/', authController.authenticate)
router.post('/create', authController.create)
router.post('/refresh', authController.refresh)
router.get('/key', authController.key)
router.post('/username', authController.username)

if (process.env.NODE_ENV !== 'production') {
  // only for testing purpose
  router.get('/validate', authController.validate)
}


module.exports = router;
