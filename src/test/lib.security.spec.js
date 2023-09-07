process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const Security = require('../lib/security')
const Setup = require('./test.setup')


describe('lib.security', async() => {

  let user
  before( async() => {
    await Setup.setup()
    user = await Setup.createUser()
  })

  it('create a jwt', () => {
    let tokens = Security.generateTokens(user, '1234')
    assert.equal(user._id.toString(), Security.decryptUser(tokens.token))
    assert.equal('1234', Security.decryptProject(tokens.token))
  })

  it('create new jwt from refresh', () => {
    let tokens = Security.generateTokens(user, '1234')
    let newToken = Security.refreshToToken(tokens.refreshToken)
    assert.equal(user._id.toString(), Security.decryptUser(newToken))
    assert.equal('1234', Security.decryptProject(newToken))
  })
})
