const Factory = require('../lib/factory');
// const userModel = require('../models/user');
const userModel = Factory.create('user')
const Bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const Const = require('../lib/const')
const Config = require('config');

module.exports = {
  /**
   * create a new user
   * @param req
   * @param res
   * @param next
   */
  create: function(req, res, next) {
      userModel.create({ name: req.body.name, email: req.body.email, password: req.body.password }, res,function (err, result) {
      if (err)
        next(err);
      else
        res.json({status: 'ok', message: "user added successfully", data: null});

    });
  },
}
