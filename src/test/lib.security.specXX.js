process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const Security = require('../lib/security')

describe('lib.security', async() => {
  it ('create jwt - only id', async() => {
    let jwt = Security.JWTEncode('12345')
    assert.isTrue(jwt.length > 10)
  })

  it('decode - only id', async() => {
    const ID = '12355'
    let jwt = Security.JWTEncode(ID)
    assert.isTrue(jwt.length > 10)
    let sec = Security.JWTDecode(jwt)
    assert.equal(sec.id, ID)
  })

  it ('create jwt - data', async() => {
    let jwt = Security.JWTEncode('12345', {message: 'some'})
    assert.isTrue(jwt.length > 10)
  })

  it('decode - only id', async() => {
    const ID = '12355'
    const extra = {message: 'some', work: [1,2,3], done: {id:123}}
    let jwt = Security.JWTEncode(ID, extra)
    assert.isTrue(jwt.length > 10)
    let sec = Security.JWTDecode(jwt)
    assert.equal(sec.id, ID)
    assert.isDefined(sec.data)
    assert.equal(sec.data.message, extra.message)
  })

  it ('decode - false jwt', async() => {
    const ID = '12355'
    let jwt = Security.JWTEncode(ID)
    assert.isTrue(jwt.length > 10)
    jwt += 'err'
    try {
      let sec = Security.JWTDecode(jwt)
      assert.fail('Should throw an error')
    } catch (e) {
      assert.equal(e.name, 'JWTError')
    }
  })

  it('build refresh token', async() => {
    const ID = '12355'
    const extra = {message: 'some', work: [1,2,3], done: {id:123}}
    let jwt = Security.JWTEncode(ID, extra)

    const refId = '7'
    let refresh  = Security.JWTRefreshEncode(refId, jwt)
    assert.isTrue(refresh.length > 10)

    let tk = Security.JWTRefreshDecode(refresh)
    assert.equal(ID, tk.id)
    assert.equal(refId, tk.refreshId)
    assert.equal(extra.message, tk.data.message)
  })

  it('generate jwt from refresh', async() => {
    const ID = '12355'
    const extra = {message: 'some', work: [1,2,3], done: {id:123}}
    let jwt = Security.JWTEncode(ID, extra)

    const refId = '7'
    let refresh  = Security.JWTRefreshEncode(refId, jwt)

    let newToken = Security.JWTFromRefresh(refresh)
    let newDec = Security.JWTDecode(newToken)
    assert.equal(newDec.id, ID)
    assert.equal(newDec.data.message, extra.message)
  })
})
