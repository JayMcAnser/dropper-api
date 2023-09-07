


// const Bcrypt = require('bcrypt');
// const Jwt = require('jsonwebtoken');
// const Config = require('config')
// const Jsonfile = require('jsonfile');
// const Helper = require('../lib/helper');
// const { v4 : uuidv4} = require('uuid');
const Logging = require('../lib/logging')
const UserModel = require('./user-model');
const Bcrypt = require('bcrypt');

module.exports = {

  info() {
    return {
      type: 'user.flex'
    }
  },

  /**
   *
   * @param user Object (username, email, password, etc)
   * @return {Promise<*>}
   * @throws Error not implemented
   */
  create: async function(user) {
    // return UserModel.create(user);
    Logging.logThrow('not implemented' /*Const.errors.notImplemented */, 'user-flex.create');
  },

  /**
   * delete a user defined by the where
   * @param where
   * @returns {boolean}
   */
  delete(where) {
    Logging.logThrow('not implemented' /*Const.errors.notImplemented */, 'user-flex.delete');
  },

  /**
   * find one record
   *
   * @param what object holding the values of the found user
   * @returns {Promise<Object | false>}>}
   */
  findOne: async function(what) {
    return UserModel.findOne(what)
    // Logging.logThrow(Const.errors.notImplemented, 'user-flex.findOne');
  },

  passwordValid(password, passwordHash) {
    return Bcrypt.compare(password, user.passwordHash)
  },
  /**
   * find the user by the id
   * @param id
   * @returns {*|boolean}
   */
  async findById(id) {
    return UserModel.findById(id);
    // Logging.logThrow(Const.errors.notImplemented, 'user-flex.findById');
  },


  /**
   * set the internal refresh token that allows to reset the account for a user
   * @param user
   * @returns {Promise<boolean>}
   */
  async checkRefreshToken(user) {
    if (user.refreshId === undefined) {
      user.refreshId = Math.ceil(Math.random() * 2000)
      return await user.save()
    }
    return true;
  },

  async guest() {
    Logging.logThrow('Guest is missing' /*onst.errors.userGuestIsMissing */)
  }
}

