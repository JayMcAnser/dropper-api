const Factory = require('../lib/factory');
const UserModel = Factory.create('user')
//const UserModel = require('../models/user');
const Bcrypt = require('bcrypt');
// const Const = require('../lib/const')
const Config = require('config');
const Jwt = require('jsonwebtoken');
const Logging = require('../lib/logging');
const ApiReturn = require('../lib/api-return');
const wcMatch = require('wildcard-match')

const USER_FIELDS = [
  'username', 'email', 'rights', 'urlAccess'
]
const COOKIE_NAME = 'dropperAuth'

const _copyUserFields = (data) => {
  let result = {}
  for (let index = 0; index < USER_FIELDS.length; index++) {
    result[USER_FIELDS[index]] = data[USER_FIELDS[index]]
  }
  return result;
}

const _configDefault = (key, defaultValue) => {
  if (Config.has(key)) {
    return Config.get(key)
  }
  return defaultValue
}

const _setupLogging = function(req) {
  if (!req.session) {
    req.session = {
      user: {id: 0}
    }
  }
  req.session.log = function(level, message) {
    Logging.log(level, message)
  };
}

const _createSession = async function(userId) {
  let session = new (Factory.create('session'));
  await session.init(userId)
  return session;
}

module.exports = {
  /**
   * the creation of a user
   * @param req
   * @param res
   * @param next
   */
  create: function(req, res, next) {
    res.json({status: Const.status.error, message: 'create user is not allowed', data: {}})
  },

  info: function (req, res, next) {
    return ApiReturn.result(req, res, { status: 'alive' })
  },

  /**
   * return the authentication for the user
   *
   * @param req
   * @param res
   * @param next
   * @returns {Promise<*>}
   */
  authenticate: function(req, res, next) {
    // validate the use of username of email
    let name = req.body.email || req.body.username;
    if (! name) {
      return ApiReturn.error(req, res, new Error('missing username'), 403)
    } else {
      let UserModel = Factory.create('user');
      return UserModel.findOne({email: name}).then((userInfo) => {
        try {
          if (!userInfo) {
            Logging.log('warn', `[controller.auth].authenticate user ${name} not found`)
            ApiReturn.error(req, res, Const.status.error, 'invalid email/password!', 401);
          } else {
            //if(bcrypt.compareSync(req.body.password, userInfo.password)) {
            return (UserModel.passwordValid(req.body.password, userInfo)).then( (result) => {
              if (result) {
                UserModel.checkRefreshToken(userInfo)
                const token = Jwt.sign({id: userInfo.id}, Config.get('Server.secretKey'), {expiresIn: _configDefault('Auth.tokenExpire', '1h')});
                const refreshToken = Jwt.sign({id: userInfo.id, refreshId: userInfo.refreshId}, Config.get('Server.secretKey'), {expiresIn: _configDefault('Auth.refreshExpire', '100d')});
                // https://stackoverflow.com/questions/16209145/how-to-set-cookie-in-node-js-using-express-framework
                // res.cookie(COOKIE_NAME, token)
                // headers = {
                //   'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly`,
                //   "Access-Control-Allow-Credentials": "true"
                // };
                ApiReturn.result(req, res, {
                  user: _copyUserFields(userInfo),
                  token,
                  refreshToken,
                }, `user '${userInfo.username}' logged in`,
  //                200,
  //                {headers}
                 )
              } else {
                ApiReturn.error(req, res, new Error('invalid email/password'), 200)
              }
            })
          }
        } catch (e) {
          ApiReturn.error(req, res, `[controller.auth].authenticate unexpected error: ${e.message}`)
        }
      }).catch(  (e) => {
        ApiReturn.error(req, res, `[controller.auth].access denied: ${e.message}`, 401)
      })
    }
  },

  async refresh(req, res) {
    let token = req.body.token;
    if (!token || token.length < 10) {
      return ApiReturn.error(req, res, new Error(Const.results.noToken), 401 )
    } else {
      try {
        let decoded = Jwt.verify(
          token,
          Config.get('Server.secretKey'));
        // decoded: id, refreshId
        let UserModel = Factory.create('user')
        let userInfo = await UserModel.findById(decoded.id)
        if ((userInfo.refreshId === decoded.refreshId)) {
        //  ApiReturn.error(req, res, new Error(Const.results.tokenExpired), 401)
          let token = Jwt.sign({id: userInfo.id}, Config.get('Server.secretKey'), {expiresIn: _configDefault('Auth.tokenExpire', '1h')})
          // res.writeHead(200, {
          //   'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly`,
          //   "Access-Control-Allow-Credentials": "true",
          //   'access-control-expose-headers': 'Set-Cookie'
          // })
//           res.cookie(COOKIE_NAME, token)
          ApiReturn.result(req, res, {
            user: _copyUserFields(userInfo),
            token: token,
          }, `user '${userInfo.username}' restored`);
        } else {
          ApiReturn.error(req, res, new Error(Const.results.tokenExpired), 401)
        }
      } catch (e) {
        ApiReturn.error(req, res, e, 401)
      }
    }
  },


  /**
   * internal used for testing.
   * DO NOT CALL FROM ANY WORKING SOFTWARE
   */
  async createSession(userId) {
    return _createSession(userId)
  },

  /**
   * validate the user against the encrypted key
   * @param req
   * @param res
   * @param next
   */
  async validate(req, res, next) {
    try {
      let token = req.headers && req.headers['authorization'] ? req.headers['authorization'] : ''
      let UserModel = Factory.create('user');
      try {
        if (token.length && token.substring(0, 'bearer'.length).toUpperCase() === 'BEARER') {
          token = token.substring('bearer'.length).trim()
        }
        if (!token || (typeof token === 'string' && token.length === 0)) {
          token = req.cookies ? req.cookies[COOKIE_NAME] : ''
        }
        let decoded
        try {
          decoded = Jwt.verify(
            token,
            Config.get('Server.secretKey'));
        } catch(e) {
          if (e.message === 'jwt must be provided') {

            let user = await UserModel.findOne({username: 'anon'})
            if (!user) {
              console.log('[error]: the user with the key anon does not exist')
              throw new Error('token is missing')
            }
            decoded ={
              id: user.id
            };
          } else {
            throw e;
          }
        }
        req.session = await _createSession(decoded.id)
        req.user = await UserModel.findById(decoded.id)
        // check our access right to the url
        let apiAccess = req.session.user.apiAccess
        for (let index = 0; index < apiAccess.length; index++) {
          if (wcMatch(apiAccess[index])(req.baseUrl || '')) {
            _setupLogging(req)
            //  res.json({status: Const.status.success, message: 'user logged in', data: null})
            if (next) {
              next()
            }
            return 'ok'
          }
        }
        delete req.session
        throw new Error('no access to the url')
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          ApiReturn.error(req, res, err, 'token expired', 401)
        } else if (!token) {
          ApiReturn.error(req, res, err, Const.results.accessDenied, 403);
          // res.json({status: Const.status.error, message: Const.results.accessDenied, data: null})
        } else {
          ApiReturn.error(req, res, err, err.message, 403)
          // res.json({status: Const.status.error, message: err.message, data: null})
        }
      }
    } catch(e) {
      ApiReturn.error(req, res, e)
      // res.json({status: Const.status.error, message: `[authController.validate] ${e.message}`, data: null})
    }
  }
}
