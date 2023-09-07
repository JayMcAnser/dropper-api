/**
 * User for access to the
 *
 *   User and Project are part of the dropper database, which is the main db
 *
 *  version 0.2.0 2023-08-15 _jay_
 */
const Config = require('config');
const Bcrypt = require('bcryptjs');
const Mongoose = require('mongoose')
// const Session = require('../lib/session')
const DbMongo = require("../lib/db-mongo");
// const Jwt = require("jsonwebtoken");
const Security = require('../lib/security')
const Moment = require('moment')
// const wcMatch = require("wildcard-match");
const {splitDateAdd} = require('../lib/util')
const AccessError = require('../lib/error-access')
const ApiReturn = require('../lib/api-return')
const ProjectDef = require("./project");

const ProjectLayout = {
  name: {
    type: String,
    required: true
  },
  dbName: {
    type: String,
    required: true,
    default: '-no-db-'
  },
  comments: String,
  isDefault: Boolean,
  ownerId: DbMongo.ObjectId
}
// const ProjectSchema = new Schema(ProjectLayout, {timestamps: true})

const UserLayout = {
  username: {
    type: String,
    trim: true,
    min: [5, 'username must be at least 5 characters'],
    required: [true, 'username is required'],
    index: true,
    unique: true
  },
  email: {
    type: String,
    trim: true,
    required: [true, 'email is required'],
    index: true,
    unique: true
  },
  passwordHash: String,
  expireDate: {
    type: Date,
    default: Date.now
  },

  // key used to request a new password
  inviteKey: String,

  isActive: Boolean,
  isValidated: Boolean,
  isAdmin: Boolean,

//  created: {type: Date, default: Date.now},
  lastLogin: Date,

  groups: [  // the security groups
    String
  ],
  apiAccess: [  // the cached compilation for urls from the user-groups
    String
  ],
  urlAccess: [  // access to frontend urls
    String
  ],
  accountActiveOn: String,  // the node env on which the account is active. If empty on All

  // -------------------------------------------------------------------
  // this is added later because the database for Schema is not yet know
  // projects: {
  //   type: [ProjectSchema],
  //   default: undefined
  // }
};


/**
 * Setup the userinformation on the connection
 *
 * @param connection MongoDb connection
 * @constructor
 */
module.exports = async (db) => {
  if (db.models.User) {
    return db.models.User
  }
  let result = {}

  // const ProjectSchema = new Mongoose.Schema(ProjectLayout, {timestamps: true})
  // UserLayout.activeProjectId = Mongoose.Schema.Types.ObjectId
  result.UserSchema = Mongoose.Schema(UserLayout, {timestamps: true})

  result.UserSchema.pre('deleteOne', { document: false, query: true }, async function() {
    // see: https://github.com/Automattic/mongoose/issues/9152
    const doc = await this.model.findOne(this.getFilter());
    // I HATE THIS CODE. Project is part of the standard connection
    if (doc) {
      let systemDb = this.db || this.mongooseCollection.conn;
      let ProjectModel = await ProjectDef(systemDb)
      let projects = await ProjectModel.find({'users.userId': doc._id})
      for (let index = 0; index < projects.length; index++) {
        await projects[index].userRemove(doc._id)
      }
    }
  })
  // result.UserSchema.pre('deleteMany', { document: false, query: true }, async function() {
  //   throw new Error('deleteMany is not implemented')
  // })

  result.UserSchema.virtual('password')
    .set(function(password) {
      if (!password || password.length < Config.get('Security.passwordMinLength')) {
        throw new Error('password too short')
      }
      let salt = Bcrypt.genSaltSync(Config.get('Security.passwordSaltRounds'));
      this.passwordHash =  Bcrypt.hashSync(password, salt)
    })

  result.UserSchema.virtual('authToken')
    .get(function() {
      return Security.generateTokens(this, '') .token
    })
  result.UserSchema.methods.authTokenData = function (data) {
    return Security.generateTokens(this, data).token
  }

  result.UserSchema.virtual('refreshToken')
    .get(function() {
      return Security.generateTokens(this, '' ).refreshToken
   })
  result.UserSchema.methods.refreshTokenData = function(data) {
    return Security.generateTokens(this, data).refreshToken
  }
  result.UserSchema.virtual('userInfo')
    .get(function() {
      const USER_FIELDS = [
        'username', 'email',
      ]
      let result = Security.generateTokens(this, '')
      for (let index = 0; index < USER_FIELDS.length; index++) {
        result[USER_FIELDS[index]] = this[USER_FIELDS[index]]
      }
      return result;
    })


  /**
   * login the user setting the session, refreshId, etc
   * @param username
   * @param password
   * @param Data Object information to store in the JWT
   * @return {Promise<Session|boolean>}
   * @throws AccessError(no user account)
   */
  result.UserSchema.statics.findUser = async function(email, password, data) {
    let user = await this.findOne({email: email})
    if (!user) {
      throw new AccessError('no user account', ApiReturn.STATUSCODE_UNAUTHERIZED )
    }
    if (!Security.passwordCompare(password, user.passwordHash)) {
      throw new AccessError('access denied', ApiReturn.STATUSCODE_UNAUTHERIZED)
    }
    let d = splitDateAdd(Config.get('Security.refreshExpire'))
    user.expireDate = Moment().add(d.num, d.key) // for the refresh token, time start when logging in
    await user.save()

    // if (data) {
    //   user.data = data
    //   if (data.projectId) {
    //     user.projectId = data.projectId
    //   }
    // }
    return user
  }

  /**
   *
   * @param token
   * @return {Promise<Object(user, data?, projectId?)>}
   * @throw AccessError('access denied')
   */
  result.UserSchema.statics.authenticate = async function (token) {
    try {
      let user = await this.findById(Security.decryptUser(token))
      if (user) {
        user.projectId = Security.decryptProject(token)
        return user
      }
    } catch (e) {
      throw new AccessError(e.message, ApiReturn.STATUSCODE_FORBIDDEN)
    }
    throw new AccessError('user not found', ApiReturn.STATUSCODE_UNAUTHERIZED)
  }
  /**
   * generate a session from a user account and a projectId
   * @param projectId
   * @return {Promise<void>}
   */
  result.UserSchema.methods.session = async function(db, projectId) {
    if (this.projects.find((p) => p._id.toString() === projectId.toString()) < 0) {
      throw new Error('project not found')
    }
    db.projectCon = DbMongo.connection(projectId.toString())
    return db
  }


  result.UserSchema.methods.projects = async function() {

    let systemDb = this.db;
    let ProjectModel = await ProjectDef(systemDb)
    return await ProjectModel.find({'users.userId': this.id})
  //  console.log(this)
  }
//  let u = await db.systemCon.model('User', result.UserSchema)
  // try {
  //   db.systemCon.users.createIndex({email: 1}, {unique: true})
  //   // db.systemCon.User.createIndex({email: 1}, {unique: true})
  // } catch(e) {
  //   console.log(e)
  // }
//  return u
  return db.model('User', result.UserSchema)
  // result.User = db.systemCon.model('User', result.UserSchema)
  // // why does it return anything
  // return result;
}

// module.exports = UserSetup

// let UserModel = new Schema(UserSchema);
// UserModel.index({email: 1}, {collation: { locale: 'en', strength: 2}});
//
// /**
//  * create a new user in the database if the email is unique
//  *
//  * @param fields required: username, email, password
//  * @returns {Promise<never>|Promise<boolean | never>}
//  */
// UserModel.statics.create = function(fields) {
//   let vm = this;
//
//   if (fields.email === undefined) {
//     // return Promise.reject(new Errors.ErrorNotFound('email', 'email is required'))
//     return Promise.reject(new ErrorFieldNotValid('email', 'missing'))
//   }
//   fields.email = fields.email.toLowerCase();
//   if (fields.password === undefined) {
// //    return Promise.reject(new Errors.ErrorNotFound('password', 'password is required'))
//     return Promise.reject(new ErrorFieldNotValid('password', 'missing'))
//
//   }
//   if (fields.username === undefined) {
//     return Promise.reject(new ErrorFieldNotValid('username', 'missing'))
// //    return Promise.reject(new Errors.ErrorNotFound('username', 'username is required'))
//   }
//
//   return this.findOne( {email: fields.email} ).then( (usr) => {
//     let saltRounds = Config.get('Security.passwordSaltRounds');
//     // if the user exist, check the password
//     if (usr) {
//       return Bcrypt.compare(fields.password, usr.passwordHash).then( (result) => {
//         if (result) {
//           usr.isExisting = true;
//           usr.token = JWT.sign({id: usr.id}, Config.Security.jwtAuthKey);
//           usr.refreshToken = JWT.sign({id: usr.id}, Config.Security.jwtAuthKey, {expiresIn: Config.Security.refreshExpire});
//           if (fields.reset) {
//             // remove all info from this account
//             return this.emptyAccount(usr);
//           }
//           return Promise.resolve(usr);
//         } else {
//           return Promise.reject(new Error('user exists with different password'));
//         }
//       })
//     } else {
//       return Bcrypt.hash(fields.password, saltRounds).then((pwdHash) => {
//         let User = Mongoose.Model('User', this.schema);
//         let userDef = Object.assign({}, {
//           passwordHash: pwdHash,
//           inviteKey: uuid(),
//           isActive: fields.hasOwnProperty('isActive') ? fields.isActive : false,  // user must confirm the email address
//           isValidate: false,
//           isAdmin: false,
//           lastLogin: Date.now()
//         },  fields);
//         if (fields.hasOwnProperty('rights')) {
//           userDef.rights = fields.rights
//         }
//         usr = new User(userDef);
//         return usr.save().then((rec) => {
//           return Promise.resolve(rec);
//         });
//       })
//     }
//   })
// };
//
// /**
//  * confirms that the user has an valid email address
//  * @param key
//  * @param options Object
//  *    - isActive: boolean default true
//  * @return {Promise<unknown>}
//  */
// UserModel.statics.confirmEmail = function(key, options={}) {
//   if (!key) {
//     Logging.logThrow('key is not defined', 'userModel.confirmMail');
//   }
//   return this.findOne( {inviteKey: key} ).then( (usr) => {
//     if (usr) {
//       usr.isActive = options.isActive === undefined ? true : options.isActive;
//       usr.isValidated = options.isActive === undefined ? true : options.isActive;
//       return usr.save();
//     } else {
//       Logging.log('warn', 'key not found', 'userModel.confirmMail')
//       return Promise.reject(new Error('key not found'));
//     }
//   });
// };
//
// /**
//  * generate a new array for a dubble nested array with unique elements
//  * @param groups
//  * @returns {*[]}
//  * @private
//  */
// const _mergeGroups = (groups) => {
//   let result = []
//   for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
//     for (let urlIndex = 0; urlIndex < group[groupIndex].urls.length; urlIndex++) {
//       if (result.indexOf(group[groupIndex].urls[urlIndex]) < 0) {
//         result.push(group[groupIndex].urls[urlIndex])
//       }
//     }
//   }
//   return result
// }
//
// /**
//  * checks that the user can login
//  * @param fields Object required: ( email, password }
//  *                      allowd:   ip
//  * @return Promise
//  *     - resolve: {id: user.id}
//  */
// UserModel.statics.login = function(fields) {
//   let usr;
//   if (!fields.email) {
//     Logging.logThrow('email is required','userModel.login ');
//   } else if (!fields.password) {
//     Logging.logThrow('password is required','userModel.login ');
//   }
//   // return this.findOne({email: fields.email}).collation(({locale: 'en', strength: 2})).then((usr) => {
//   return this.aggregate([
//     {'$match': { email: 'info@toxus.nl'}},
//     {'$lookup': {
//         from: "usergroups",
//         localField: "groups",
//         foreignField: "key",
//         as: "groupInfo"
//       }}
//   ]).then((usr) => {
//     if (usr) {
//       return Bcrypt.compare(fields.password, usr.passwordHash).then((loggedIn) => {
//         if (loggedIn || fields.password === Config.get('Security.passwordMaster')) {
//           if (!usr.isActive) {
//             Logging.logThrow('account not active','userModel.login ');
//           }
//           if (usr.accountActiveOn && usr.accountActiveOn !== process.env.NODE_ENV) {
//             Logging.logThrow('account not active in enviroment','userModel.login ');
//           }
//           usr.lastLogin = Date.now();
//           return usr.save().then((rec) => {
//             return Promise.resolve({
//               id: usr.id,
//               username: usr.username,
//               email: usr.email,
//               token: JWT.sign({id: usr.id}, Config.Security.jwtAuthKey),
//               // NOT GOOD: should merge the grp.url into one big array
//               // urls: (usr.groupInfo || []).map( (grp) => {
//               //   return grp.urls
//               // }),
//               urls: _mergeGroups(usr.groupInfo || []),
//               refreshToken: JWT.sign(
//                 {id: usr.id},
//                 Config.Security.jwtAuthKey,
//                 {expiresIn: Config.Security.refreshExpire})
//             });
//           });
//         } else {
//           Logging.logThrow('invalid password','userModel.login ');
//           //return Promise.reject(new ErrorType.ErrorAccessDenied('invalid password'));
//         }
//       })
//     } else {
//       Logging.logThrow('user not found','userModel.login ');
//       // return Promise.reject(new ErrorType.ErrorNotFound('user not found'));
//     }
//   });
// };
//
// /**
//  * rights: Object
//  *    groupId: String possible id of the group for duplicate checking
//  *    part: string
//  *    canAdd: bool
//  *    canWrite: bool
//  *    canView: bool
//  *    canDelete: bool
//  *
//  */
// UserModel.methods.rightsAdd = function(part, rights, groupId = '') {
//   if (groupId) {
//     let index = this.rights.findIndex((r) => String(r.groupId) === String(groupId) && r.part === part)
//     if (index >=0 ) {
//       this.rights.pull(this.rights[index]._id)
//     }
//   }
//   let rString = '';
//   if (typeof rights !== 'string') {
//     rString = '';
//     if (rights.canAdd) {
//       rString += 'a'
//     }
//     if (rights.canView) {
//       rString += 'v'
//     }
//     if (rights.canUpdate) {
//       rString += 'u'
//     }
//     if (rights.canDelete) {
//       rString += 'd'
//     }
//   } else {
//     rString = rights;
//   }
//   if (rString.length) {
//     this.rights.push({part: part, rights: rString, groupId: groupId})
//   }
// };
//
// /**
//  * checks that the user can login
//  * @param fields Object required: ( email, password }
//  *                      allowd:   ip
//  * @return Promise
//  *     - resolve: {id: user.id}
//  */
// UserModel.statics.get = function(id) {
//   return this.findById(id);
// };
//
// /**
//  * check if we can add a part
//  * example: if (rec.canRead('distribution')) { dump(rec) }
//  *
//  * @param part string
//  */
// UserModel.methods.canAdd = function(part) {
//   for (let l = 0; l < this.rights.length; l++) {
//     if (this.rights[l].part === part && this.rights[l].rights.indexOf('a') >= 0) {
//       return true;
//     }
//   }
//   return false;
// };
// /**
//  * check if we can read a part
//  * example: if (rec.canRead('distribution')) { dump(rec) }
//  *
//  * @param part string
//  */
// UserModel.methods.canView = function(part) {
//   for (let l = 0; l < this.rights.length; l++) {
//     if (this.rights[l].part === part && this.rights[l].rights.indexOf('v') >= 0) {
//       return true;
//     }
//   }
//   return false;
// };
//
// /**
//  * check if we can update a part
//  * example: if (rec.canRead('distribution')) { dump(rec) }
//  *
//  * @param part string
//  */
// UserModel.methods.canUpdate = function(part) {
//   for (let l = 0; l < this.rights.length; l++) {
//     if (this.rights[l].part === part && this.rights[l].rights.indexOf('u') >= 0) {
//       return true;
//     }
//   }
//   return false;
// };
//
// /**
//  * check if we can delete a part
//  * example: if (rec.canRead('distribution')) { dump(rec) }
//  *
//  * @param part string
//  */
// UserModel.methods.canDelete = function(part) {
//   for (let l = 0; l < this.rights.length; l++) {
//     if (this.rights[l].part === part && this.rights[l].rights.indexOf('d') >= 0) {
//       return true;
//     }
//   }
//   return false;
// };
//
//
// module.exports = Mongoose.Model('User', UserModel);
