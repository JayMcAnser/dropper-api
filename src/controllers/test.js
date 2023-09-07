const ApiReturn = require('../lib/api-return');
// const Const = require('../lib/const')
const DbMongo = require('../lib/db-mongo');
const Logging = require("../lib/logging");
const Jwt = require("jsonwebtoken");
const Config = require("config");
const Auth = require('../controllers/auth')
const Errors = require('../lib/errors')


module.exports = {
  index: async function(req, res) {
    return ApiReturn.result(req, res, {status: 'alive'}, 200)
  },

  /**
   * query the interface
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  info: async function (req, res) {
    try {
      let data = {
        status: 'api running normal',
        version: require('../../package.json').version
      }
      return ApiReturn.result(req, res, data, ApiReturn.STATUSCODE_OK)
    } catch (e) {
      ApiReturn.error(req, res, e, ApiReturn.STATUSCODE_INTERNAL_ERROR)
    }
  },

  /**
   * returns a 403 error
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  noAuth: async function(req, res) {
    return ApiReturn.error(req, res, new Error('access denied'), 'access denied', 403);
  },

  authGetInfo: async function(req, res) {
    if (Auth.validate(req, res,
      () => {
        return ApiReturn.result(req, res, {message: 'did auth'})
      }
    ));
  },

  authDataValidationError: async function(req, res) {
    // if (Auth.validate(req, res,
    //   () => {
    //     return ApiReturn.error(req, res,
    //       new Error('This is not right')
    //     ,200)
    //   }
    // ));
    let errors = [];
    const count = req.query.count ? req.query.count : 1
    for (let index = 0; index < count; index++) {
      errors.push(new (Errors.ValidationError)(`field${index + 1}`, Errors.VALIDATION_REQUIRED, 'There is no data'))
    }

    return ApiReturn.error(req, res,
      errors
      ,200)
  },

}
