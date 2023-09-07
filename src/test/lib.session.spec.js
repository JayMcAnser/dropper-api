process.env.NODE_ENV = 'test';


const chai = require('chai');
const assert = chai.assert;
const Config = require('config')
const Session = require('../lib/session')
const DbMongo = require('../lib/db-mongo')
const AccessError = require('../lib/error-access')

describe('lib.session', async() => {

  const USERNAME = Config.get('Test.username')
  const PASSWORD = Config.get('Test.password')
  const EMAIL = Config.get('Test.email')

  let dbSystem

  before(async () => {
    dbSystem = await DbMongo.connection()
    const UserSetup = require('../model/user-model')
    let userModel = await UserSetup(dbSystem)
    await userModel.deleteMany({})
  })

  it('create user', async() => {
    let session = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
    try {
      assert.deepEqual(session.user, {})
      await session.create()
      assert.isDefined(session.user._id)
    } finally {
      assert.isTrue(await session.close())
    }
  })
  it('validate login', async() => {
    let session = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
    try {
      assert.deepEqual(session.user, {})
      await session.open()
      assert.isDefined(session.user._id)
    } finally {
      assert.isTrue(await session.close())
    }

  })
  it('create same again (error)', async() => {
    let session = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
    assert.deepEqual(session.user, {})
    try {
      await session.create()
      assert.fail('should throw an error duplicate')
    } catch (e) {
      assert.equal(e.name,'AccessError')
    } finally {
      assert.isTrue(await session.close())
    }
  })

  it('add project to multiple users', async() => {
    let session = new Session({email: '3-' + EMAIL, username: '3-' + USERNAME, password: PASSWORD})
    let session2 =new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
    try {
      await session.create()
      let prj = await session.projectAdd({title: '3-TEST'})
      assert.equal(prj.title, '3-TEST')
      assert.equal((await session.user.projects()).length, 1)

      // add this project to another user
      await session2.open()
      let prj2 = await session2.projectAdd(prj)
      assert.equal(prj2._id.toString(), prj._id.toString())

    } finally {
      await session2.close() // can return false if the session did not use the use database
      await session.close()
    }
  })


  // TODO validate minimum fields
})
