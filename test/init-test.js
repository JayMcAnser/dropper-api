/**
 * all test run this file first
 */
const app = require('../index');


const EMAIL = 'private@example.com';
const PASSWORD = 'very-secret'
const User = require('../models/user');
// let user;


/**
 * return the auth key of a user
 * @type {Promise<unknown>}
 */
module.exports.AuthToken = new Promise((resolve, reject) => {
  return User.findOne({email: EMAIL}).then( (user) => {
    if (!user) {
      user = User.create({name:'test', email: EMAIL, password: PASSWORD})
    }

    const AuthController = require('../controllers/auth');
    // trick the auth in thinking we are a express
    let res = {
      _obj: {},
      _state: '',
      setHeader : (data) => {},
      status: function(state) { this._state = state},
      json: function(obj) {this._obj = obj}
    };

    return AuthController.authenticate(
      { body: {username: EMAIL, password: PASSWORD} },
      res,
      (err) => { console.error(err)}
    ).then(() => {
      if (res._state === 200) {
        return resolve(res._obj.data.token)
      } else {
        return resolve(false);
      }
    });
  })
});

module.exports.AuthUserId = new Promise((resolve) => {
  return User.findOne({email: EMAIL}).then( async(user) => {
    if (!user) {
      user = await User.create({name: 'test', email: EMAIL, password: PASSWORD})
    }
    resolve(user.id);
  })
})


module.exports.AuthEmail = EMAIL;
module.exports.AuthPassword = PASSWORD;
