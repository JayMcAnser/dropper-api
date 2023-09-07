/**
 * test of the card controller
 *
 * version 0.0.1 Jay 2023-08-07
 */
process.env.NODE_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http'); //types');
chai.use(chaiHttp);
const assert = chai.assert;
const ApiResult = require('../lib/api-return')
const Setup = require('./test.setup')
const Config = require("config");
const server = 'http://localhost:' + Config.get('Server.port') + '/api';

describe('controller.card', () => {
  let TOKEN;
  let Session
  let cardId

  before(async () => {
    const main = require('../index')
    // what we need is an empty, active account and empty project
    await Setup.setup()
    Session = await Setup.createAccount()
    let r = await Session.projectAdd({title: 'The card tester'})
    TOKEN = Session.userInfo.token
  });

  after(async() => {
    await Session.close()
    await Setup.terminate()
  })

  it('create - security', async() => {
    let result = await chai.request(server)
      .post('/card')
      .send({title: 'test'})
    assert.equal(result.status, ApiResult.STATUSCODE_UNAUTHERIZED)
  })
  it('create - allowed', async() => {
    let result = await chai.request(server)
      .post('/card')
      .send({title: 'test'})
      .set('authorization', `bearer ${TOKEN}`)
    assert.equal(result.status, ApiResult.STATUSCODE_OK)
    assert.isDefined(result.body.data.id)
    cardId = result.body.data.id
  })
  it('list - not allowed', async() => {
    let result = await chai.request(server)
      .get('/card')
    assert.equal(result.status, ApiResult.STATUSCODE_UNAUTHERIZED)
  })
  it ('list, by id', async() => {
    let result = await chai.request(server)
      .get('/card')
      .query({id: cardId})
      .set('authorization', `bearer ${TOKEN}`)

    assert.equal(result.status, ApiResult.STATUSCODE_OK)
    assert.equal(result.body.data.title, 'test')
  })
  it ('list, multiple', async() => {
    let result = await chai.request(server)
      .get('/card')
      .query({all: true})
      .set('authorization', `bearer ${TOKEN}`)

    assert.equal(result.status, ApiResult.STATUSCODE_OK)
    assert.equal(result.body.data.length, 1)

    // add an extra card
    result = await chai.request(server)
      .post('/card')
      .send({title: 'test 2'})
      .set('authorization', `bearer ${TOKEN}`)
    assert.equal(result.status, ApiResult.STATUSCODE_OK)

    result = await chai.request(server)
      .get('/card')
      .query({all: true})
      .set('authorization', `bearer ${TOKEN}`)

    assert.equal(result.status, ApiResult.STATUSCODE_OK)
    assert.equal(result.body.data.length, 2)
    assert.equal(result.body.data[1].title, 'test 2')
  })
})
