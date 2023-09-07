process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const Session = require('../lib/session')
const DbMongo = require('../lib/db-mongo')
const Config = require('config')

const ProjectDef = require('../model/project')
const UserDef = require('../model/user-model')

describe('model.project', async() => {
  let UserModel
  let ProjectModel

  let user
  const USERNAME = 'p' + Config.get('Test.username')
  const PASSWORD = 'p' + Config.get('Test.password')
  const EMAIL = 'p' + Config.get('Test.email')

  const TITLE = 'project '

  before(async () => {
    let systemDb = await DbMongo.connection()
    UserModel = await UserDef(systemDb)
    user = await UserModel.findOne({email: EMAIL})
    if (!user) {
      user = await UserModel.create({email: EMAIL, username: USERNAME, password: PASSWORD})
    }
  })

  after( async() => {
    // if (ProjectModel) {
    //   await ProjectModel.deleteMany({})
    //   await UserModel.deleteMany({})
    // }
  })

  it('create a project', async () => {
    let systemDb = await DbMongo.connection()
    ProjectModel = await ProjectDef(systemDb)
    assert.isDefined(ProjectModel)
    let result = await ProjectModel.create({title: TITLE + '1', ownerId: user._id})
    assert.isDefined(result)
    assert.equal(result.ownerId.toString(), user._id.toString())
  })

  it('create two project, same owner', async() => {
    let systemDb = await DbMongo.connection()
    ProjectModel = await ProjectDef(systemDb)
    assert.isDefined(ProjectModel)
    let result = await ProjectModel.create({title: TITLE + '2', ownerId: user._id})
    assert.isDefined(result)
    assert.equal(result.ownerId.toString(), user._id.toString())
    let projects = await ProjectModel.findUserProjects(user)
    assert.equal(projects.length, 2)
    projects = await ProjectModel.findUserProjects(user._id)
    assert.equal(projects.length, 2)
  })

  it('create different user', async() => {
    let user2 = await UserModel.create({email: EMAIL+ 'a', username: USERNAME +'a', password: PASSWORD})
    let systemDb = await DbMongo.connection()
    ProjectModel = await ProjectDef(systemDb)
    let result = await ProjectModel.create({title: TITLE + '3', ownerId: user2._id})
    let projects = await ProjectModel.findUserProjects(user2)
    assert.equal(projects.length, 1)
     projects = await ProjectModel.findUserProjects(user)
    assert.equal(projects.length, 2)
  })

})
