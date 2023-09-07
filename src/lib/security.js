
const Config = require('config')
const Jwt = require("jsonwebtoken");
const Bcrypt = require("bcryptjs");
const Cryptr = require('cryptr')
// const AccessError = require('./error-access')
// const ApiReturn = require("./api-return");

class JWTError extends Error {
  constructor(message) {
    super(message); // (1)
    this.name = "JWTError"; // (2)
  }
}

const passwordCompare = (password, passwordHash) => {
  return Bcrypt.compareSync(password, passwordHash)
}
const emailDecrypt = (cr) => {
  let cryptr = new Cryptr(Config.get('Security.cryptKey'))
  return cryptr.decrypt(cr)
}
const emailEncrypt = (email) => {
  let cryptr = new Cryptr(Config.get('Security.cryptKey'))
  return cryptr.encrypt(email)
}



/**
 * generate the tokens holding the data
 *
 * @param user Object<Model>
 * @param projectId String
 * @constructor
 * @return Object
 *   token: String
 *   refreshToken: String
 *
 */
const generateTokens = (user, projectId) => {
  let payload = {
    user: user._id.toString(),
    projectId: projectId
  }
  let refExp = user.expireDate.getTime()// - new Date().getTime()
  return {
    token:Jwt.sign( payload, Config.get('Security.jwtAuthKey'), {expiresIn: Config.get('Security.tokenExpire')}),
    refreshToken: Jwt.sign(payload, Config.get('Security.jwtAuthKey'), {expiresIn:refExp})
  };
}

const _decrypt = (token) => {
  try {
    return Jwt.verify(
      token,
      Config.get('Security.jwtAuthKey'));
  } catch(e) {
    throw new JWTError(e.message)
  }

}
const decryptUser = (token) => {
  let data = _decrypt(token)
  return data.user
}
const decryptProject = (token) => {
  let data = _decrypt(token)
  return data.projectId
}
const refreshToToken = (refreshCode) => {
  let payload = _decrypt(refreshCode)
  delete payload.iat
  delete payload.exp
  return Jwt.sign( payload, Config.get('Security.jwtAuthKey'), {expiresIn: Config.get('Security.tokenExpire')})
}



//
//
//
// /**
//  *
//  * @param userId String
//  * @param data Object
//  * @return String JWT key
//  * @constructor
//  */
// const JWTEncode = (id, data) => {
//   let payload = { id }
//   if (data) {
//     payload.data = data
//   }
//   return token = Jwt.sign( payload, Config.get('Security.jwtAuthKey'), {expiresIn: Config.get('Security.tokenExpire')});
// }
//
// /**
//  * decode a JWT into the
//  * @param jwt String
//  * @return Object
//  * @throws EJWT error
//  *   - userId String The id of the user
//  *   - data Object The extra information
//  */
// const  JWTDecode = (jwt) => {
//   let decoded
//   try {
//     decoded = Jwt.verify(
//       jwt,
//       Config.get('Security.jwtAuthKey'));
//     return decoded
//   } catch(e) {
//     throw new JWTError(e.message)
//   }
// }
//
// /**
//  *
//  * @param refreshId String The unique id to identify the id in the token
//  * @param jwt String original jwt token
//  * @return {String}
//  * @constructor
//  */
// const JWTRefreshEncode = (refreshId, jwt) => {
//   let struct = JWTDecode(jwt)
//   struct.refreshId = refreshId
//   delete struct.exp
//   return Jwt.sign(struct, Config.get('Security.jwtAuthKey'), {expiresIn: Config.get('Security.refreshTokenExpire')});
// }
// /**
//  *
//  * @param jwt String
//  * @return Object
//  *    id: String,
//  *    refreshId: String,
//  *    data?: Object
//  * @throws JWTError
//  */
// const JWTRefreshDecode = (jwt) => {
//   let decoded
//   try {
//     decoded = Jwt.verify(
//       jwt,
//       Config.get('Security.jwtAuthKey'));
//     return decoded
//   } catch(e) {
//     throw new JWTError(e.message)
//   }
// }
//
// /**
//  * given a refresh token a new JWT is generated
//  * @param refreshToken String
//  * @return String
//  * @throws JWTError
//  */
// const JWTFromRefresh = (refreshToken) => {
//   let payload = JWTRefreshDecode(refreshToken)
//   delete payload.iat
//   delete payload.exp
//   // return JWTEncode(struct.id, struct.data)
//   return Jwt.sign( payload, Config.get('Security.jwtAuthKey'), {expiresIn: Config.get('Security.tokenExpire')})
// }


// /**
//  * encrypt the email so we can compare it
//  * @param email String
//  * @return {String}
//  */
// const emailCrypt = (email) => {
//   let salt = Bcrypt.genSaltSync(Config.get('Security.passwordSaltRounds'));
//   return Bcrypt.hashSync(email.toLowerCase(), salt)
// }
// /**
//  *
//  * @param email String
//  * @param emailHash String
//  * @return {Boolean}
//  */
// const emailCompare = (email, emailHash) => {
//   return Bcrypt.d
//   if (!email || !emailHash) {
//     throw new AccessError('missing email', ApiReturn.STATUSCODE_BAD_REQUEST)
//   }
//   return Bcrypt.compareSync(email.toLowerCase(), emailHash)
// }



module.exports = {
  // JWTEncode,
  // JWTDecode,
  // JWTRefreshEncode,
  // JWTRefreshDecode,
  // JWTFromRefresh,

  decryptUser,
  decryptProject,
  refreshToToken,

  passwordCompare,
  emailEncrypt,
  emailDecrypt,

  generateTokens,

  JWTError
}
