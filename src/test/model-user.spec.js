process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const UserDef = require('../model/user-model')
const Session = require('../lib/session')
const DbMongo = require('../lib/db-mongo')
const Config = require('config')
const ProjectDef = require("../model/project");


describe('user-model', async() => {
  before(async () => {

  })

  after(async() => {
    await UserModel.deleteMany({})
  })

  const USERNAME = 'm' + Config.get('Test.username')
  const PASSWORD = 'm' + Config.get('Test.password')
  const EMAIL = 'm' + Config.get('Test.email')

  let UserModel
  let ProjectModel
  it('create a user model', async() => {
    UserModel = await UserDef(await DbMongo.connection())
    assert.isDefined(UserModel)
    ProjectModel = await ProjectDef(await DbMongo.connection())
  })


  it('find a user', async() => {
    assert.isDefined(UserModel.findOne)
    let usr = await UserModel.findOne({username: USERNAME})
    if (!usr) {
      usr = await UserModel.create({email: EMAIL, username: USERNAME, password: PASSWORD})
    }
    assert.isDefined(usr._id)
  })

  it ('login a user', async() => {
    let usr = await UserModel.findUser(EMAIL, PASSWORD)
    assert.isDefined(usr)
    assert.isFalse(usr.isNew)
  })


  it('user projects - auto remove', async() => {
    let user
    let projects
    try {
      user = await UserModel.findUser(EMAIL, PASSWORD)
      projects = await user.projects()
      assert.equal(projects.length, 0)

      let prj = await ProjectModel.create({title: 'user 1', ownerId: user.id})
      assert.isDefined(prj._id)

      projects = await user.projects()
      assert.equal(projects.length, 1)
    } finally {
      await UserModel.deleteOne({_id: user._id.toString()})
      projects = await user.projects()
      assert.equal(projects.length, 0, 'should remove the project too')
    }
  })

  // it('session - login or authToken', async() => {
  //   let session = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
  //   await session.open()
  //   assert.isDefined(session.projects)
  //   assert.isDefined(session.User._id)
  //
  //   // test the auth key
  //   let authKey = session.User.authToken
  //   assert.isDefined(authKey)
  //   let ses2 = new Session({token: authKey})
  //   await ses2.open()
  //   assert.isDefined(session.projects)
  //   assert.isDefined(session.User._id)
  //
  //   // should be the same record
  //   assert.equal(session.projects[0]._id.toString(), ses2.projects[0]._id.toString())
  // })


})
