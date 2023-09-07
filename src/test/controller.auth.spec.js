
/**
 * testing the auth controller
 */

process.env.NODE_ENV = 'test';
process.env["NODE_CONFIG_DIR"] = __dirname + '/../../config/';

// const Init = require('./init-test');
const chai = require('chai');
const chaiHttp = require('chai-http'); //types');
chai.use(chaiHttp);
const assert = chai.assert;
const Config = require('config');
const Session = require('../lib/session')
const Security = require('../lib/security')
const DbMongo = require('../lib/db-mongo')

const server = 'http://localhost:' + Config.get('Server.port') + '/api';
const ROOT = '/auth';


// const AuthController = require('../controllers/auth')
const UserDef = require('../model/user-model')

describe('controller-auth', () => {

  const EMAIL =  Config.get('Test.user')
  const EMAIL_HASH = Security.emailEncrypt(EMAIL)
  const PASSWORD = Config.get('Test.password')
  const USERNAME = Config.get('Test.username')

  let UserClass;

  before(async() => {
    // start the server
    const main = require('../index')
    let db = await DbMongo.connection()
    UserClass = await UserDef(db)
    let usr = await UserClass.deleteOne({email: EMAIL})
  })

  after( async() => {
    let db = await DbMongo.connection()
    UserClass = await UserDef(db)
    let usr = await UserClass.deleteOne({email: EMAIL})
  })

  it('create user', async() => {
    let result = await chai.request(server)
      .post(ROOT + '/create')
      .send({
        username: USERNAME,
        password: PASSWORD,
        mailKey: EMAIL_HASH
      })
    assert.equal(result.status, 200)
    assert.isDefined(result.body.data)
    assert.isDefined(result.body.data.token)
    assert.isDefined(result.body.data.refreshToken)
    assert.equal(result.body.data.username, USERNAME);
    assert.equal(result.body.data.email, EMAIL)
  });

  it('login user', async () => {
    let result =  await chai.request(server)
        .post(ROOT)
        .send({
          email: EMAIL,
          password: PASSWORD
        })
    // the user does NOT send a projectId, so no card, or open project yet possible
    assert.equal(result.status, 200)
    assert.isDefined(result.body.data)
    assert.isDefined(result.body.data.token)
    assert.isDefined(result.body.data.refreshToken)
    assert.equal(result.body.data.username, USERNAME)
    assert.equal(result.body.data.email, EMAIL)
    assert.isUndefined(result.body.data.projectId)
  });

  it('login user - wrong password', async () => {
    let result =  await chai.request(server)
      .post(ROOT)
      .send({
        email: EMAIL,
        password: PASSWORD + '99'
      })
    assert.equal(result.status, 401)
    assert.isDefined(result.body.errors)
    assert.isDefined(result.body.errors.length, 1)
    assert.isDefined(result.body.errors[0])
    assert.equal(result.body.errors[0].title, 'access denied')
  });

  it('refresh token', async () => {
    let result =  await chai.request(server)
      .post(ROOT)
      .send({
        email: EMAIL,
        password: PASSWORD,

      })
    let token = result.body.data.refreshToken
    assert.isUndefined(result.body.data.projectId)
    result =  await chai.request(server)
      .post(ROOT + '/refresh')
      .send({
        token
      })
    assert.equal(result.status, 200)
    assert.isDefined(result.body.data)
    assert.isDefined(result.body.data.token)
    assert.isDefined(result.body.data.refreshToken)
    assert.isUndefined(result.body.data.projectId, 'no projectId was given')
  });

  it('authorization', async() => {
    const KEY = Config.get('Security.testProjectKey')
    let result =  await chai.request(server)
      .post(ROOT)
      .send({
        email: EMAIL,
        password: PASSWORD,
        projectId: KEY
      })
     assert.isDefined(result.body.data.projectId)
     assert.isTrue(result.body.data.projectId.length > 10, 'it changes because it adds a fake one')
     let projectKey = result.body.data.projectId
     result =  await chai.request(server)
      .post(ROOT + '/refresh')
      .send({
        token: result.body.data.refreshToken
      })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.projectId, projectKey)
  })
})


