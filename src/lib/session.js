/**
 * basic session class
 *
 * to open a session:
 *   let session = new Session(req)
 *       -- userId is in the req.header.token
 *       -- projectId is in the req.header.token
 * or
 *   let session = new Session({username, password, projectId})
 */
const DbMongo = require('./db-mongo')
const AccessError = require('./error-access')
const Security = require('./security')
const ApiReturn = require("./api-return");
const Config = require('config')
const assert = require('../lib/logging').assert

class Session {

  constructor(options = {}) {
    if (options.headers) {
      // options === request
      this._authToken = false
      let token = options.headers && options.headers['authorization'] ? options.headers['authorization'] : ''
      if ((token.length && token.substring(0, 'bearer'.length).toUpperCase() === 'BEARER')) {
        this._authToken = token.substring('bearer'.length).trim()
      }
      this._projectId = false
    } else {
      this._email = options.email
      this._password = options.password
      this._username = options.username
      this._authToken = options.token
      this._projectId = options.projectId
    }
    this._user = null
  }

  // _loadConInfo(con) {
  //   this._user = false
  //   this._project = false
  // }

  /**
   * init the model classes
   * if not project is active the models.Card will be false
   * @return {Promise<void>}
   * @private
   */
  async _initModels() {
    const UserDef = require("../model/user-model");
    const ProjectDef = require("../model/project");
    this._UserModel = await UserDef(await DbMongo.connection())
    this._ProjectModel = await ProjectDef(await DbMongo.connection())
    this._CardModel = false
  }
  // async _initRecords() {
  //   if (this.projectId) {
  //     this._project = await this.model.Project.findById(this.projectId)
  //     if (!this._project) { // the project is not found
  //       this._projectId = false
  //       throw new Error ('project not found')
  //     }
  //     this._CardModel = await CardDef(await DbMongo.connection(this.project.dbName))
  //   } else {
  //     this._project = false
  //   }
  // }
  /**
   * create a user
   * @return {Promise<void>}
   */
  async create() {
    await this._initModels()
    try {
      await this.model.User.create({email: this._email, password: this._password, username: this._username})
      this._user = await this.model.User.findUser(this._email, this._password)
      await this.activeProject(this._projectId)
    } catch (e) {
      await this.close()
      if (e.code === 11000) { // duplicate value
        throw new AccessError('duplicate email', ApiReturn.STATUSCODE_BAD_REQUEST )
      }
      throw e
    }
  }

  /**
   *
   * @return {Promise<Tokens>}
   */
  async login() {
    await this._initModels()
    try {
      this._user = await this.model.User.findUser(this._email, this._password)
      // we now need to set the current Project to.
      await this.activeProject(this._projectId)
      return Security.generateTokens(this.user, this.projectId)
    } catch (e) {
      this.close()
      throw e
    }
  }
  async open() {
    await this._initModels()
    try {
      if (this._authToken) {
        this._user = await this.model.User.authenticate(this._authToken)
        this._projectId = Security.decryptProject(this._authToken)
      } else {
        this._user = await this.model.User.findUser(this._email, this._password)
        this._projectId = this._user.projectId // this can be undefined
      }
      await this.activeProject(this._projectId)
    } catch (e) {
      await this.close()
      throw e
    }
    // await this._initRecords()
  }

  async refresh() {
    await this._initModels()
    try {
      if (this._authToken) {
        let token =  Security.refreshToToken(this._authToken)
        this._user = await this.model.User.authenticate(token)
        await this.activeProject(Security.decryptProject(token))
        return token
        // this._user = await this.model.User.authenticate(this._authToken)
      } else {
        this.close()
        throw new Error('no refresh token')
      }
    } catch (e) {
      await this.close()
      throw e
    }
  }

  async close() {
    let result = true
    if (this._project) {
      result = await DbMongo.close(this._project.dbName)
    }
    this._CardModel = false
    this._projectId = false
    this._project = false
    return result
  }

  /**
   * activate the project and changes the CardModel to the version of the project
   * @param projectId
   * @return {Promise<void>}
   */
  async activeProject(projectId) {
    this._projectId = projectId
    if (this._projectId) {
      this._project = await this.model.Project.findById(this._projectId)
      if (!this._project) {
        if (this._projectId === Config.get('Security.testProjectKey')) {
          this._project = await this.model.Project.findOne({title: Config.get('Security.testProjectKey')})
          if (!this._project) {
            this._project = await this.projectAdd({title: Config.get('Security.testProjectKey')})
            this._projectId = this._project._id.toString()
            this._CardModel = await this._project.CardModel()
            return
          }
        }
        assert(false, `project ${projectId} not found`)
        this._projectId = false
        throw new Error('no project active')
      }
      this._CardModel = await this._project.CardModel()
    } else {
      this._project = false
      this._CardModel = false
    }
  }

  // -->> use: user.projects()
  // get userProjects() {
  //   return this.user.projects
  // }
  get user() {
    return (this._user || {} )
  }
  get project() {
    return this._project
  }
  get userId() {
    return this.user._id
  }

  get projectId() {
    return this._projectId
  }
  /**
   * return the direct access to the MongoDb models
   *
   * @return {{Project: Model | false, User:  Model | false, Card:  Model | false}}
   */
  get model() {
    return {
      Card: this._CardModel,
      Project: this._ProjectModel,
      User: this._UserModel
    }
  }

  /**
   * add a project to the current user and activate it
   * this should change the jwtToken refreshToken !!!
   *
   * @param project
   * @param state see: project.userAdd
   * @return {Promise<Project>}
   */
  async projectAdd(project, state = {canComment: true} ) {
    let cProj = project
    if (!project._id) { // it's a new project, that will auto add to this user
      cProj = await this.model.Project.create(Object.assign({}, project, {ownerId: this.user._id}))
    } else {
      await cProj.userAdd(this.user._id, state)
    }
    await this.activeProject(cProj._id)
    return cProj
  }

  /**
   * create a new card within the current project
   * @param card
   * @return {Promise<void>}
   */
  async cardAdd(card) {
    assert(this.projectId, 'no project active', {exec: () => { throw new Error('no project active')}})
    // ToDo check the rights
    let cardData = Object.assign({}, card, {ownerId: this.userId.toString()})
    let cardRec = await this.model.Card.create(cardData)
    return cardRec
  }
  /**
   * check if in the user table the email address already exists
   * @return {Promise<boolean>}
   */
  async emailExists() {
    await this._initModels()
    let usr = await this.model.User.findOne({email: this._email})
    return !!usr
  }

  async usernameExists() {
    await this._initModels()
    if (!this._username || this._username.length === 0) {
      return true // empty names are never allowed
    }
    // must be case-insensitive
    return !!await this.model.User.findOne({username: {$regex: this._username, $options: 'i'}})
  }

  get userInfo() {
    let projectId = this.projectId ? this.projectId.toString(): this.projectId
    let data = Security.generateTokens(this.user, projectId)
    data.projectId = projectId

    return data;
  }

}
module.exports = Session
