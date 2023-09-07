/**
 * User for access to the API
 *
 *  version 0.0.2 2024-03-14 _jay_
 */
const Mongoose = require('../lib/db-mongo');
const Schema = Mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const Config = require('config');
const Bcrypt = require('bcryptjs');
const Logging = require('../lib/logging');
const uuid = require('uuid').v4;
const JWT = require('jsonwebtoken');



const RightsSchema = {
  module: String, // a . separate list
  rights: Number
};

const ProjectLayout = {
  name: {
    type: String,
    required: true
  },
  comments: String,
  isDefault: Boolean,
}

const UserSchema = {
  username: {
    type: String,
    trim: true,
    min: [5, 'username must be at least 5 characters'],
    required: [true, 'username is required'],
  },
  email: String,
  passwordHash: String,
  refreshId: String,     // force the refresh token to expire

  // key used to request a new password
  inviteKey: String,

  isActive: Boolean,
  isValidated: Boolean,
  isAdmin: Boolean,

  created: {type: Date, default: Date.now},
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

  rights: [
    RightsSchema
  ],

  projects: {
    type: [ProjectLayout],
    default: undefined
  }
};


let UserModel = new Schema(UserSchema);
UserModel.index({email: 1}, {collation: { locale: 'en', strength: 2}});

/**
 * create a new user in the database if the email is unique
 *
 * @param fields required: username, email, password
 * @returns {Promise<never>|Promise<boolean | never>}
 */
UserModel.statics.create = function(fields) {
  let vm = this;

  if (fields.email === undefined) {
    // return Promise.reject(new Errors.ErrorNotFound('email', 'email is required'))
    return Promise.reject(new ErrorFieldNotValid('email', 'missing'))
  }
  fields.email = fields.email.toLowerCase();
  if (fields.password === undefined) {
//    return Promise.reject(new Errors.ErrorNotFound('password', 'password is required'))
    return Promise.reject(new ErrorFieldNotValid('password', 'missing'))

  }
  if (fields.username === undefined) {
    return Promise.reject(new ErrorFieldNotValid('username', 'missing'))
//    return Promise.reject(new Errors.ErrorNotFound('username', 'username is required'))
  }

  return this.findOne( {email: fields.email} ).then( (usr) => {
    let saltRounds = Config.get('Security.passwordSaltRounds');
    // if the user exist, check the password
    if (usr) {
      return Bcrypt.compare(fields.password, usr.passwordHash).then( (result) => {
        if (result) {
          usr.isExisting = true;
          usr.token = JWT.sign({id: usr.id}, Config.Security.jwtAuthKey);
          usr.refreshToken = JWT.sign({id: usr.id}, Config.Security.jwtAuthKey, {expiresIn: Config.Security.refreshExpire});
          if (fields.reset) {
            // remove all info from this account
            return this.emptyAccount(usr);
          }
          return Promise.resolve(usr);
        } else {
          return Promise.reject(new Error('user exists with different password'));
        }
      })
    } else {
      return Bcrypt.hash(fields.password, saltRounds).then((pwdHash) => {
        let User = Mongoose.Model('User', this.schema);
        let userDef = Object.assign({}, {
          passwordHash: pwdHash,
          inviteKey: uuid(),
          isActive: fields.hasOwnProperty('isActive') ? fields.isActive : false,  // user must confirm the email address
          isValidate: false,
          isAdmin: false,
          lastLogin: Date.now()
        },  fields);
        if (fields.hasOwnProperty('rights')) {
          userDef.rights = fields.rights
        }
        usr = new User(userDef);
        return usr.save().then((rec) => {
          return Promise.resolve(rec);
        });
      })
    }
  })
};

/**
 * confirms that the user has an valid email address
 * @param key
 * @param options Object
 *    - isActive: boolean default true
 * @return {Promise<unknown>}
 */
UserModel.statics.confirmEmail = function(key, options={}) {
  if (!key) {
    Logging.logThrow('key is not defined', 'userModel.confirmMail');
  }
  return this.findOne( {inviteKey: key} ).then( (usr) => {
    if (usr) {
      usr.isActive = options.isActive === undefined ? true : options.isActive;
      usr.isValidated = options.isActive === undefined ? true : options.isActive;
      return usr.save();
    } else {
      Logging.log('warn', 'key not found', 'userModel.confirmMail')
      return Promise.reject(new Error('key not found'));
    }
  });
};

/**
 * generate a new array for a dubble nested array with unique elements
 * @param groups
 * @returns {*[]}
 * @private
 */
const _mergeGroups = (groups) => {
  let result = []
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (let urlIndex = 0; urlIndex < group[groupIndex].urls.length; urlIndex++) {
      if (result.indexOf(group[groupIndex].urls[urlIndex]) < 0) {
        result.push(group[groupIndex].urls[urlIndex])
      }
    }
  }
  return result
}

/**
 * checks that the user can login
 * @param fields Object required: ( email, password }
 *                      allowd:   ip
 * @return Promise
 *     - resolve: {id: user.id}
 */
UserModel.statics.login = function(fields) {
  let usr;
  if (!fields.email) {
    Logging.logThrow('email is required','userModel.login ');
  } else if (!fields.password) {
    Logging.logThrow('password is required','userModel.login ');
  }
  // return this.findOne({email: fields.email}).collation(({locale: 'en', strength: 2})).then((usr) => {
  return this.aggregate([
    {'$match': { email: 'info@toxus.nl'}},
    {'$lookup': {
        from: "usergroups",
        localField: "groups",
        foreignField: "key",
        as: "groupInfo"
      }}
  ]).then((usr) => {
    if (usr) {
      return Bcrypt.compare(fields.password, usr.passwordHash).then((loggedIn) => {
        if (loggedIn || fields.password === Config.get('Security.passwordMaster')) {
          if (!usr.isActive) {
            Logging.logThrow('account not active','userModel.login ');
          }
          if (usr.accountActiveOn && usr.accountActiveOn !== process.env.NODE_ENV) {
            Logging.logThrow('account not active in enviroment','userModel.login ');
          }
          usr.lastLogin = Date.now();
          return usr.save().then((rec) => {
            return Promise.resolve({
              id: usr.id,
              username: usr.username,
              email: usr.email,
              token: JWT.sign({id: usr.id}, Config.Security.jwtAuthKey),
              // NOT GOOD: should merge the grp.url into one big array
              // urls: (usr.groupInfo || []).map( (grp) => {
              //   return grp.urls
              // }),
              urls: _mergeGroups(usr.groupInfo || []),
              refreshToken: JWT.sign(
                {id: usr.id},
                Config.Security.jwtAuthKey,
                {expiresIn: Config.Security.refreshExpire})
            });
          });
        } else {
          Logging.logThrow('invalid password','userModel.login ');
          //return Promise.reject(new ErrorType.ErrorAccessDenied('invalid password'));
        }
      })
    } else {
      Logging.logThrow('user not found','userModel.login ');
      // return Promise.reject(new ErrorType.ErrorNotFound('user not found'));
    }
  });
};

/**
 * rights: Object
 *    groupId: String possible id of the group for duplicate checking
 *    part: string
 *    canAdd: bool
 *    canWrite: bool
 *    canView: bool
 *    canDelete: bool
 *
 */
UserModel.methods.rightsAdd = function(part, rights, groupId = '') {
  if (groupId) {
    let index = this.rights.findIndex((r) => String(r.groupId) === String(groupId) && r.part === part)
    if (index >=0 ) {
      this.rights.pull(this.rights[index]._id)
    }
  }
  let rString = '';
  if (typeof rights !== 'string') {
    rString = '';
    if (rights.canAdd) {
      rString += 'a'
    }
    if (rights.canView) {
      rString += 'v'
    }
    if (rights.canUpdate) {
      rString += 'u'
    }
    if (rights.canDelete) {
      rString += 'd'
    }
  } else {
    rString = rights;
  }
  if (rString.length) {
    this.rights.push({part: part, rights: rString, groupId: groupId})
  }
};

/**
 * checks that the user can login
 * @param fields Object required: ( email, password }
 *                      allowd:   ip
 * @return Promise
 *     - resolve: {id: user.id}
 */
UserModel.statics.get = function(id) {
  return this.findById(id);
};

/**
 * check if we can add a part
 * example: if (rec.canRead('distribution')) { dump(rec) }
 *
 * @param part string
 */
UserModel.methods.canAdd = function(part) {
  for (let l = 0; l < this.rights.length; l++) {
    if (this.rights[l].part === part && this.rights[l].rights.indexOf('a') >= 0) {
      return true;
    }
  }
  return false;
};
/**
 * check if we can read a part
 * example: if (rec.canRead('distribution')) { dump(rec) }
 *
 * @param part string
 */
UserModel.methods.canView = function(part) {
  for (let l = 0; l < this.rights.length; l++) {
    if (this.rights[l].part === part && this.rights[l].rights.indexOf('v') >= 0) {
      return true;
    }
  }
  return false;
};

/**
 * check if we can update a part
 * example: if (rec.canRead('distribution')) { dump(rec) }
 *
 * @param part string
 */
UserModel.methods.canUpdate = function(part) {
  for (let l = 0; l < this.rights.length; l++) {
    if (this.rights[l].part === part && this.rights[l].rights.indexOf('u') >= 0) {
      return true;
    }
  }
  return false;
};

/**
 * check if we can delete a part
 * example: if (rec.canRead('distribution')) { dump(rec) }
 *
 * @param part string
 */
UserModel.methods.canDelete = function(part) {
  for (let l = 0; l < this.rights.length; l++) {
    if (this.rights[l].part === part && this.rights[l].rights.indexOf('d') >= 0) {
      return true;
    }
  }
  return false;
};


module.exports = Mongoose.Model('User', UserModel);
