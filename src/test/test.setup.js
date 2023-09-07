const DbMongo = require("../lib/db-mongo");
const UserDef = require("../model/user-model");
const ProjectDef = require('../model/project')
const Session = require('../lib/session')
const ApiReturn = require('../lib/api-return')
const Config = require("config");
const { assert } = require('../lib/logging')

let systemDb
let UserModel
let ProjectModel
let CardModel

let user = []
const USERNAME = Config.get('Test.username')
const PASSWORD = Config.get('Test.password')
const EMAIL = Config.get('Test.email')

module.exports = {
  setup: async function() {
    systemDb = await DbMongo.connection()
    UserModel = await UserDef(systemDb)
    ProjectModel = await ProjectDef(systemDb)
  },

  createUser: async function(index) {
    if (!user[index]) {
      await this.setup()
      for (let i = 0; i < index; i++) {
        if (!user[i]) {
          user[i] = false
        }
      }
      if (!user[index]) {
        user[index] = await UserModel.findOne({username: `${index}-${USERNAME}`})
        if (!user[index]) {
          user[index] = await UserModel.create({email: `${index}-${EMAIL}`, username: `${index}-${USERNAME}`, password: PASSWORD})
        }
      }
    }
    return user[index]
  },
  user: async function(index = 1) {
    return this.createUser(index)
  },

  async createAccount(index= 0) {
    let session = new Session({username: `${index}-${USERNAME}`, password: `${index}${PASSWORD}`, email: `${index}-${EMAIL}`})
    try {
      await session.open()
    } catch (e) {
      if (e.status === ApiReturn.STATUSCODE_UNAUTHERIZED ) {
        await session.create()
      } else {
        throw e
      }
    }
    await session.model.Project.deleteMany({})
    await session.projectAdd({title: `${index} - project`})
    assert(session.projectId, 'no project active')
    return session
  },

  terminate: async function() {
    for (let index = 0; index < user.length; index++) {
      if (user[index]) {
        UserModel.deleteOne({username: user[index].username})
      }
    }
    // temp:
    await ProjectModel.deleteMany({})
    user = []
  }
}
