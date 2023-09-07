/**
 * Project
 * The grouping of Cards
 *
 */

const dbMongo = require('../lib/db-mongo')
const Mongoose = require('mongoose')
const Schema = Mongoose.Schema;
const Card = require('./card')
const ObjectId = Schema.ObjectId
const Types = Mongoose.Types
const {assert} = require('../lib/logging')

const ProjectUserLayout = {
  userId: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  email: {  // the user invited
    type: String
  },
  shareState: { // how the other user reacted
    type: String,
    enum: ['pending', 'accepted', 'reject']
  },
  shareCount: { // number of time the other user responded
    type: Number,
  },
  canComment: {
    type: Boolean,
    default: true
  },
  canEdit: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}

const ProjectLayout =  {
  title: {
    type: String,
    require: true,
    trim: true
  },
  ownerId: {
    type: Schema.ObjectId,
    required: true,
    ref: 'User'
  },
  orderKey: String,
  comment: String,
  dbName: {  // most of the time the _id
    type: String,
    require: true
  },
  users: [ProjectUserLayout]
}

module.exports = async (db) => {
  if (db.models.Project) {
    return db.models.Project
  }
  let ProjectSchema = Mongoose.Schema(ProjectLayout, {timestamps: true})

  ProjectSchema.pre('save', function (next, opt, opt2) {
    if (!this.users) {
      this.users = []
    }
    // owner should always be one the users, with admin rights
    let index = this.users.findIndex((u) => u.userId.toString() === this.ownerId.toString())
    if (index < 0) {
      this.users.push({userId: this.ownerId, canComment: true, canEdit: true})
      index = 0;
    }
    if (!this.users[index].isAdmin) {
      this.users[index].isAdmin = true
    }
    if (!this.dbName || this.dbName.length === 0) {
      this.dbName = new Mongoose.Types.ObjectId().toString()
    }
    next()
  })
  /**
   *
   * @param user UserModel || ObjectId
   * @return {Promise<[ProjectModel]>}
   */
  ProjectSchema.statics.findUserProjects = async function(user) {
    let id = user._id || user
    return this.find({'users.userId': id})
  }

  /**
   * Add a user to this project
   * @param userId the id of the user or the email address
   * @param state
   *    email
   *    canComment
   *    canEdit
   *    isAdmin
   * @return {Promise<void>}
   */
  ProjectSchema.methods.userAdd = async function(userId, state) {
    if (!this.users) { this.users = []}
    if (userId) {
      let index = this.users.findIndex((u) => u.userId.toString() === userId.toString())
      if (index >= 0) {
        return this.users[index]
      }
    } else if (state.email && state.email.length) {
      let index = this.users.findIndex((u) => u.email.toLowerCase() === state.email.toLowerCase())
      if (index >= 0) {
        return this.users[index]
      }
    }
    this.users.push({
      userId: userId,
      email: state.email,
      canComment: state.canComment,
      canEdit: state.canEdit,
      isAdmin: state.isAdmin
    })
    this.markModified('users')
    await this.save()
    return this.users[this.users.length - 1]
  }
  /**
   * filters the user out of the related project as user or if owner deletes the project
   * @param id
   * @return {Promise<void>}
   */
  ProjectSchema.methods.userRemove = async function(id) {
    if (id.toString() === this.ownerId.toString()) {
      // deleting the user deletes all their projects
      await this.deleteOne({ownerId: id})
    } else {
      if (!this.users) {
        this.users = []
      }
      let index = this.users.findIndex((u) => u.userId.toString() === id.toString())
      // if (index < 0) {
        assert(index < 0, `user ${id.toString()} is not part of project ${this.title} (id: ${this._id.toString()}`)
//          console.log(`user ${id.toString()} is not part of project ${this.title} (id: ${this._id.toString()}`)
//       } else {
        this.users.splice(index, 1)
        this.markModified('users')
        await this.save()
      // }
    }
  }

  /**
   * return the Promise to the card database
   */
  ProjectSchema.virtual('db')
    .get(function() {
      return dbMongo.connection(this.dbName)
    })
  /**
   * add one card
   * @param cardInfo
   * @return {Promise<void>}
   */
  ProjectSchema.methods.cardAdd = async function(cardInfo) {
    let db = await this.db

    throw new Error('not implemented') //ToDo
  }
  /**
   * remove a card
   * @param card
   * @return {Promise<void>}
   */
  ProjectSchema.methods.cardDelete = async function(card) {
    throw new Error('not implemented') //ToDo
  }
  /**
   * list all card belonging to this project
   * @param filter Object
   * @return {Promise<void>}
   */
  ProjectSchema.methods.cards = async function(filter = {}) {
    throw new Error('not implemented') //ToDo
  }

  ProjectSchema.statics.userProjects = async function(userId, filter = {}) {
    try {
      let query = [
        {$match: {'users.userId': new Mongoose.Types.ObjectId(userId)}},
        {$lookup: {
            from: "users",
            localField: "ownerId",
            foreignField: "_id",
            as: "ownerData"
          }
        },
        {$set: {
          'owner': '$ownerData.username'
        }},
        {$unwind: '$owner'},
        {$unset: 'ownerData'},
        {$sort: {orderKey: 1, title: 1}}
      ]
      let data = await db.models.Project.aggregate(query)
      return data
    }catch (e) {
      console.assert(true, e)
    }
  }
  /**
   * takes care that Card is in the different database as the projects/users
   * @return {Promise<CardModel>}
   * @constructor
   */
  ProjectSchema.methods.CardModel = async function() {
    return await Card(await dbMongo.connection(this.dbName))
  }

  if (!db.systemCon) {
    if (!db.models.Project) {
      return db.model('Project', ProjectSchema)
    }
    return db.models.Project
  }
  return await db.systemCon.model('Project', ProjectSchema)
}
