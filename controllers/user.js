const userModel = require('../models/user');
const Bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Const = require('../lib/const')
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
        res.json({status: Const.status.success, message: "user added successfully", data: null});

    });
  },
}
