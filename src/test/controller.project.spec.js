/**
 * testing the Project controller
 */
process.env.NODE_ENV = 'test';
process.env["NODE_CONFIG_DIR"] = __dirname + '/../../config/';

const Setup = require('./test.setup')
const chai = require('chai');
const chaiHttp = require('chai-http');
const Config = require("config");
const Security = require("../lib/security"); //types');
chai.use(chaiHttp);
const assert = chai.assert;

const server = 'http://localhost:' + Config.get('Server.port') + '/api';
const ROOT = '/project';

const EMAIL =  Config.get('Test.user')
const EMAIL_HASH = Security.emailEncrypt(EMAIL)
const PASSWORD = Config.get('Test.password')
const USERNAME = Config.get('Test.username')

describe('controller-project', async() => {

  let user1
  let user2

  before(async() => {
    // start the server
    const main = require('../index')
    user1 = await Setup.user(1)
    user2 = await Setup.user(2)
  })

  after(async() => {
    await Setup.terminate()

  })

  it('no access without user', async() => {
    let result = await chai.request(server)
      .get(ROOT + '/list')
    assert.equal(result.status, 401)
    // we need an authorization key
  })

  it('access with user', async() => {
    let result = await chai.request(server)
      .get(ROOT + '/list')
      .set('authorization', `bearer ${user1.authToken}`)
    assert.equal(result.status, 200, 'proper user')
    assert.equal(result.body.data.length, 0)
    result = await chai.request(server)
      .get(ROOT + '/list')
      .set('authorization', `bearer ${user2.authToken}`)
    assert.equal(result.status, 200, 'not our project')
    assert.equal(result.body.data.length, 0)
  })

  it('add project to user - rights', async() => {
    let result = await chai.request(server)
      .post(ROOT)
      .send({title: 'title 1'})
    assert.equal(result.status, 401)

    result = await chai.request(server)
      .post(ROOT)
      .send({title: 'title 1'})
      .set('authorization', `bearer ${user1.authToken}`)
    assert.equal(result.status, 200)
    assert.isDefined(result.body.data.__session)

    // the session part SHOULD be used to update the client side session!!! it stored in the __session
    assert.isDefined(result.body.data)
    let project = result.body.data
    assert.equal(project.title, 'title 1')
    assert.isDefined(project.__session.token)

    result = await chai.request(server)
      .get(ROOT + '/list')
      .set('authorization', `bearer ${user1.authToken}`)
    assert.equal(result.status, 200, '')
    assert.equal(result.body.data.length, 1)
    assert.equal(result.body.data[0].title, 'title 1')
    assert.equal(result.body.data[0].owner, '1-Test User')
  })
})

