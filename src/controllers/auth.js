
const ApiReturn = require('../lib/api-return');
const Session = require('../lib/session')
const Security = require('../lib/security')
const validateEmail = require('../lib/util').validateEmail


const USER_FIELDS = [
  'username', 'email',
]
const COOKIE_NAME = 'dropperAuth'

const _copyUserFields = (data) => {
  let result = {}
  for (let index = 0; index < USER_FIELDS.length; index++) {
    result[USER_FIELDS[index]] = data[USER_FIELDS[index]]
  }
  return result;
}

/**
 *
 * @param req
 *  email
 *  username
 *  password
 *  key  (
 *
 * @param res
 * @return {Promise<void>}
 */

const create = async (req, res) => {
  let session
  try {
    if (!req.body.mailKey || !req.body.username || !req.body.password) {
      return ApiReturn.error(req, res, 'missing key, username or password', ApiReturn.STATUSCODE_BAD_REQUEST)
    }
    let email = Security.emailDecrypt(req.body.mailKey)
    session = new Session({email, password: req.body.password, username: req.body.username})
    try {
      await session.create()
    } catch (e) {
      return ApiReturn.error(req, res, e.message, ApiReturn.STATUSCODE_BAD_REQUEST)
    }
    return ApiReturn.result(req, res, session.user.userInfo, ApiReturn.STATUSCODE_OK)
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    if (session) {
      await session.close()
    }
  }
}
/**
 * translate the key into the crypt key
 * only works in test and production env
 * @param req
 *   email
 *   unique
 * @param res
 * @return {Promise<void>}
 */
const key = async(req, res) => {
  let session
  try {
    if (process.env.NODE_ENV === 'production') {
      return ApiReturn.error(req, res, 'access denied', ApiReturn.STATUSCODE_FORBIDDEN)
    }
    if (!req.query.email || !validateEmail(req.query.email)) {
      return ApiReturn.error(req, res, 'no valid email address', ApiReturn.STATUSCODE_BAD_REQUEST)
    }
    if (req.query.unique) {
      session = new Session({email: req.query.email})
      if (await session.emailExists()) {
        return ApiReturn.error(req, res, 'email already in use', ApiReturn.STATUSCODE_BAD_REQUEST)
      }
    }
    let key = Security.emailEncrypt(req.query.email)
    return ApiReturn.result(req, res, {key: encodeURIComponent(key)}, ApiReturn.STATUSCODE_OK)
  } finally {
    if (session) {
      await session.close()
    }
  }
}

const username = async(req, res) => {
  if (!req.body.username) {
    return ApiReturn.error(req, res, 'missing username', ApiReturn.STATUSCODE_BAD_REQUEST)
  }
  let session
  try {
    session = new Session({username: req.body.username})
    return ApiReturn.result(req, res, {exists: await session.usernameExists()}, ApiReturn.STATUSCODE_OK)
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    if (session) {
      await session.close()
    }
  }
}

const  authenticate = async (req, res) => {
  let session
  try {
    session = new Session({email: req.body.email, password: req.body.password, projectId: req.body.projectId})
    let tokens = await session.login()
    return ApiReturn.result(req, res, Object.assign({}, session.user.userInfo, session.userInfo, tokens), ApiReturn.STATUSCODE_OK)
    // await session.open()
    // return ApiReturn.result(req, res, Object.assign({}, session.user.userInfo, session.userInfo), ApiReturn.STATUSCODE_OK)
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    if (session) {
      await session.close()
    }
  }
}

/**
 * translate the refresh token into the jwtToken
 * @param req
 *   req.body.token : refreshToken
 * @param res
 * @return {Promise<void>}
 */
const refresh = async(req, res) => {
  let session
  try {
    let token = (req.body || {}).token
    session = new Session({token})
    await session.refresh()
    return ApiReturn.result(req, res, Object.assign({}, session.user.userInfo, session.userInfo), ApiReturn.STATUSCODE_OK)
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    if (session) {
      await session.close()
    }
  }

}

/**
 * convert the Authorization into a session object on the req
 * @param req
 * @param res
 * @return {Promise<void>}
 */
const validate = async(req, res, next) => {
  try {
    req.session = session = new Session(req)
    await req.session.open()
    // ToDo we could check the path here
    next()
  } catch(e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    if (req.session) {
      await req.session.close()
    }
  }
}


module.exports = {
  create,
  authenticate,
  refresh,
  key,
  username,
  validate,

}
