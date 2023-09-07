const mongoose = require('mongoose')
const Config = require('config')
const {cloneDeep} = require("lodash");
const Fs = require("fs");
const Path = require("path");
const Mime = require('mime-types')
const Mongoose = require("mongoose");
const {assert} = require('../lib/logging')

const Schema = mongoose.Schema;
const Types = mongoose.Types
// const Model = mongoose.Model
// const ObjectId = Schema.Types.ObjectId;

const expireTime = Config.get('Server.combineTime') * 1000

const SetItemLayout = {
  cardId: {
    type: Types.ObjectId,
    ref: 'Card'
  },
  row: Number,
  column: Number,
  order: String
}

const HistoryItemLayout = {
  isUndo: {
    type: Boolean,
    default: undefined
  },
  title: String,
  type: String,
  owner: {
    type: Types.ObjectId,
    ref: 'User'
  },
  content: {
    type: String
  },
  fileKey: {
    type: String // the uuid of the file
  },
  related: {
    type: [SetItemLayout],
    default: undefined
  },
  fields: Object,
  removeFields: {
    type: [String],      // fields that where not there before this update
    default: undefined
  }
}
const HistoryItemSchema = new Schema(HistoryItemLayout, {timestamps: true})
const CardHistoryLayout = {
  cardId: {
    type: Types.ObjectId,
    ref: 'Card'
  },
  steps: [HistoryItemSchema],
  snapshotMarker: Types.ObjectId,
}
// const CardHistorySchema = new Schema(CardHistoryLayout, {timestamps: true})


const SnapshotLayout = {
  description: String,
  id: {
    type: Types.ObjectId,
    ref: 'Card',
  },
  creationDate: {
    type: Date,
    default: Date.now()
  },
}

const CardLayout = {
  title: {
    type: String,
    default: 'no title'
  },
  type: {
    type: String,
    default: 'Card',
    required: true
  },
  ownerId: {
    type: Schema.ObjectId,
    ref: 'User',
    required: true
  },
  // textCard
  content: {
    type: String,
    default: undefined
  },
  // fileCard
  // fileKey: {
  //   type: String // the uuid of the file
  // },
  related: {
    type: [SetItemLayout],
    default: undefined
  },
  fields: {    // no auto SAVE!
    type: Object,
    default: undefined
  },
  snapShots: {
    type: [SnapshotLayout],
    default: undefined
  }
}



// these fields can not be update by assign
let NONE_EDITABLE_FIELDS = ['type', 'owner', 'createdAt', 'updatedAt', 'snapShots', '_id', '__v']

class Children {
  constructor(parent) {
    if (!parent) { throw new Error('parent is mssing')}
    this._parent = parent
    if (!this.parent.related) { this.parent.related = []}
  }

  get parent() {
    return this._parent
  }

  add(session, card) {
    return this.parent.childAdd(session, card)
  }

  /**
   * remove
   * @param index Number || ObjectId
   */
  async delete(session, index) {
    return await this.parent.childDelete(session, index)
  }

  async move(session, child, position) {
    return await this.parent.childMove(session, child, position)
  }

  get length() {
    return (this.parent.related || []).length
  }


  childId(index) {
    if (index < 0 || index >= this.parent.related.length) { throw new Error('index out of range')}
    return this.parent.related[index].cardId
  }
}

class CardClass{

  constructor(options) {
    // THIS NEVER GETS CALLED !!!!!!!!!
    // Mongoose does not use the constructor
    this._expireTime = false
    this._children = false
  }

  /**
   * @param fieldname
   * @return {boolean} true if field is part of system
   * @private
   */
  _isSystemField(fieldname) {
    return fieldname.substring(0,1) === '_'
  }

  /**
   * compares two values in a type save way
   * @param fieldname
   * @param val1
   * @param val2
   * @returns boolean
   * @private
   *
   */
  _valueChanged(fieldname, val1, val2) {
    return (val1 !== val2)
  }
  _fieldValueChanged(fieldname, val1, val2) {
    return (val1 !== val2)
  }

  /**
   * check if the historystep has expire.
   * @param historyStep
   * @private true if expired
   */
  _didExpire(historyStep) {
    if (historyStep.updatedAt) {  // is a new one
      return new Date().getTime() -  historyStep.updatedAt.getTime() > this.expireTime
    }
    return false
  }

  /**
   * find the index in the related array
   *
   * @param child Number || ObjectId
   * @return {number}
   * @private
   */
  _child2index(child) {
    if (typeof child === 'object') {
      return this.related.findIndex((item) => item.cardId.toString() === child._id.toString())
    }
    return child
  }

  async _initHistory(session, options = {}) {
    this._history = await session.CardHistory.findOne({cardId: this._id})
    if (!this._history) {
      this._history = await session.CardHistory.create({cardId: this._id})
    }
    this._lastSet = this._history.steps[this._history.steps.length - 1] || false
    if (!this._lastSet || this._didExpire(this._lastSet) || options.isUndo || options.forceStep) {
      this._lastSet = {isUndo: options.isUndo || undefined}
    }
  }

  /**
   * set to false to set the system wide time, otherwise time in ms
   * @return {Boolean|number}
   */
  get expireTime() {
    return this._expireTime || Config.get('Server.combineTime') * 1000
  }
  set expireTime(val) {
    this._expireTime = val
  }

  makeObject() {
    let keys = Object.keys(this._doc)
    let result = {fields: {}}
    for (let index = 0; index < keys.length; index++) {
      if (NONE_EDITABLE_FIELDS.indexOf(keys[index]) < 0) {
        result[keys[index]] = cloneDeep(this._doc[keys[index]])
      } else if (this._isSystemField(keys[index])) {
        result[keys[index]] = this._doc[keys[index]]
      }
    }
    return result;
  }

  async _getHistory() {
    let history = await CardHistory.findOne({cardId: this._id})
    if (!history) {
      history = await CardHistory.create({cardId: this._id})
    }
    return history
  }
  async _historyLastSet(session, history, options = {}) {
    let lastSet = history.steps[history.steps.length - 1] || false
    if (!lastSet || this._didExpire(lastSet) || options.isUndo || options.forceStep) {
      lastSet = {isUndo: options.isUndo || undefined}
    }
    return lastSet
  }
  async _historyLastSetStore(history, lastSet) {
    if (!lastSet._id) {
      history.steps.push(lastSet)
    }
    await history.save()
  }
  /**
   * set the value for this object
   * @param values Object key value store
   * @param session Object
   *   extra keys can be
   *      forceUpdate Boolean if set the none editable fields are not check (to change type, file, etc)
   *      forceStep Booleap create a new step group
   *      isUndo Boolean the step is defined as undo step and break the combining of steps
   */
  async assign(session, values, options = {}) {
    await this._initHistory(session)
    let keys = Object.keys(values)

    for (let index = 0; index < keys.length; index++) {
      let fieldname = keys[index]
      if (fieldname === 'fields') {
        let fieldKeys = Object.keys(values.fields)
        let isDirty = false
        if (!this._doc.hasOwnProperty('fields')) { this.fields = {} }
        for (let fieldIndex = 0; fieldIndex < fieldKeys.length; fieldIndex++) {
          let fieldKey = fieldKeys[fieldIndex]
          if (!this._lastSet.hasOwnProperty('fields')) {
            this._lastSet.fields = {}
          }
          if (this._fieldValueChanged(fieldKey, values.fields[fieldKey], this._lastSet.fields[fieldKey])) {
            if (!this._lastSet.fields.hasOwnProperty(fieldKey)) { // its not yet stored
              if (this.fields[fieldKey]) {
                this._lastSet.fields[fieldKey] = this.fields[fieldKey]
              } else {
                if (!this._lastSet.removeFields) {this._lastSet.removeFields = []}
                this._lastSet.removeFields.push(fieldKey)
                this._history.markModified('removeFields')
              }
            }
            this.fields[fieldKey] = values.fields[fieldKey]
            isDirty = true
          }
        }
        if (isDirty) {
          this.markModified('fields')
          this._history.markModified('fields')
        }
      } else if (NONE_EDITABLE_FIELDS.indexOf(fieldname) < 0 || options.forceUpdate) {
        if (this._valueChanged(fieldname, this._doc[fieldname], values[fieldname])) {
          if (!this._lastSet[fieldname]) { // we have the original already stored
            this._lastSet[fieldname] = this._doc[fieldname]
          }
          this._doc[fieldname] = values[fieldname]
          this.markModified(fieldname)
        }
      }
    }
   // await this._historyLastSetStore(history, lastSet)
  }

  /**
   * returns the number of history steps
   * @return {Promise<number>}
   */
  async historyCount(session) {
    await this._initHistory(session)
    if (this._history) {
      return this._history.steps.length
    }
    return 1 // only the current step
  }

  _stepBack(card, step) {
    const NONE_REVERSE_FIELDNAMES = ['_id', 'updatedAt', 'related', 'createdAt', 'isUndo', 'removeFields']
    let keys = Object.keys(step)
    for (let index = 0; index < keys.length; index++) {
      let fieldname = keys[index]
      if (fieldname === 'fields') {
        let fieldKeys = Object.keys(step.fields)
        for (let fIndex = 0; fIndex < fieldKeys.length; fIndex++) {
          card.fields[fieldKeys[fIndex]] = cloneDeep(step.fields[fieldKeys[fIndex]])
        }
      } else if (fieldname === 'related') {
        card.related = [...step.related]
        if (card.related.length === 0) {
          card.related = undefined
        }
      } else if (NONE_REVERSE_FIELDNAMES.indexOf(fieldname) < 0) {
        card[fieldname] = cloneDeep(step[fieldname])
      }
    }
    for (let index = 0; index < (step.removeFields || {}).length; index++ ) {
      delete card.fields[step.removeFields[index]]
    }
    return card;
  }
  /**
   * return the card defined by a specific history
   * @param index
   * @return {Promise<Object>}
   * @throws history does not exist | exists at index
   */
  async history(session, index = 0) {
    let result = this.makeObject()
    if (index === undefined || index === 0) { // just the current card
      return result
    } else {
      let historyMaster = await session.CardHistory.findOne({cardId: this.id})
      if (historyMaster && historyMaster.steps.length) {
        if (index >= 0 && index <= historyMaster.steps.length) {
          const cnt = historyMaster.steps.length
          for (let s = 0; s < index && s < historyMaster.steps.length; s++) {
            result = this._stepBack(result, historyMaster.steps[cnt - s - 1]._doc )
          }
          return result
        } else {
          throw new Error(`the history index ${index} does not exists`)
        }
      } else
        throw new Error(`no history at ${index}`)
    }
  }

  /**
   *
   * @param index Number the index in the history that will become the current one
   * @return {Promise<CardObject>}
   */
  async undo(session, index) {
    let result = this.makeObject()
    if (index === undefined || index === 0) { // just the current card
      return result
    }
    // build the old version of the data
    let historyMaster = await session.CardHistory.findOne({cardId: this.id})
    if (historyMaster && historyMaster.steps.length) {
      if (index >= 0 && index <= historyMaster.steps.length) {
        const cnt = historyMaster.steps.length
        for (let s = 0; s < index && s < historyMaster.steps.length; s++) {
          result = this._stepBack(result, historyMaster.steps[cnt - s - 1]._doc )
        }
      } else {
        throw new Error(`the history index ${index} does not exists`)
      }
    } else {
      throw new Error(`no history at ${index}`)
    }
    // result is now the new requested state in the history
    await this.assign(session, result, Object.assign({}, session, {isUndo: true}))
    // should NOT save
    // return await this.save();
  }

  async childAdd(session, card, options = {}) {
    await this._initHistory(session)
    if (!this._doc.related) {
      this.related = []
    }
    if (this.related.findIndex((item) => item.cardId.toString() === card._id.toString()) < 0) {
      if (!this._lastSet.related) { this._lastSet.related = []}
      if (this._lastSet.related.length === 0) {
        this._lastSet.related = [...this.related] // must clone the array
      }
      this.related.push({cardId: card.id, row: options.row || 0, column: options.columns || 0, order: options.order || ''})
      this.markModified('related')
     // await this._historyLastSetStore(history, lastSet)
    }
  }
  async childMove(session, from, to = {}) {
    await this._initHistory(session)
    let fromIndex = this._child2index(from)
    let toIndex = this._child2index(to)
    if (fromIndex === toIndex) { return true}

    if (!this._lastSet || !this._lastSet.related || this._lastSet.related.length === 0) {
      this._lastSet.related = [...this.related] // must clone the array
      // this._lastSet.markModified('related')
    }
    this.related.splice(toIndex, 0, this.related[fromIndex])
    this.related.splice( toIndex < fromIndex ? fromIndex + 1: fromIndex, 1)

    this.markModified('related')
    // await this._historyLastSetStore(history, lastSet)
  }

  async childDelete(session, from) {
    await this._initHistory(session)
    let indexPos = this._child2index(from)
    if (indexPos >= 0 && indexPos < this.related.length) {
      if (!this._lastSet.related || this._lastSet.related.length === 0) {
        this._lastSet.related = [...this.related] // must clone the array
        // lastSet.markModified('related')
      }
      // this.related.pull({_id: this.related[indexPos]._id})
      this.related.splice(indexPos, 1)
      this.markModified('related')
     // await this._historyLastSetStore(history, lastSet)
      return true
    }
    return false

  }

  /**
   * this should be a property, but that never gets loaded. The class in NOT create, the functions are copied!!!!!
   * return the object to manipulate the child definitions
   */
  children() {
    if (!this._children) {
      this._children = new Children(this)
    }
    return this._children
  }

  async child(session, index) {
    return this.model('Card').findById(this.related[index].cardId)
  }
}

const CardFileLayout = {
  // field are none editable!!!
  filename: {
    type: String,
    required: true
  },
  mimeType: String,
  size: Number,
  sha1: String,
}

//
// let CardSchema = new Schema(CardLayout, {timestamps: true, discriminatorKey: 'type'});
// CardSchema.loadClass(CardClass)


// DO NOT CHANGE THE ORDER. Schema, load, post, model

// let CardModel = mongoose.model('Card', CardSchema)
let CardFileSchema = new Schema(CardFileLayout, {discriminatorKey: 'kind'})

CardFileSchema.virtual('stream')
  .get(function(value, virtual, doc) {
    let filename = Path.join(__dirname, '..', Config.get('Path.dataRoot'), doc._id.toString() )
    return Fs.createReadStream(filename)
  })

CardFileSchema.pre('save', function(next, options) {
  if (this.isNew) {
    if (!Fs.existsSync(this.filename)) {
      throw new Error('filename is required and must exist')
    }
    let filename = this.filename
    let toFilename = Path.join(__dirname, '..', Config.get('Path.dataRoot'), this._id.toString() )
    Fs.copyFileSync(filename, toFilename)
    let stats = Fs.statSync(toFilename)
    this.set({size: stats.size, filename: Path.basename(this.filename), mimeType: Mime.lookup(filename)})
    if (Config.get('Card.File.removeImport')) {
      Fs.unlinkSync(filename)
    }
  }
  next()
})
// let CardFileModel = CardModel.discriminator('File', CardFileSchema)

// for video: Fluent ffmpeg (https://creatomate.com/blog/how-to-use-ffmpeg-in-nodejs)
// image: https://www.npmjs.com/package/sharp

/**
 *
 * @param db Mongo Connection (created by await dbMongo.connection('xxx')
 * @return {Promise<Model<any>|Model<any>|Model|false>}
 * @constructor
 */
const CardDef = async (db) => {
  let result = {}

  if (db.models.Card) {
    return db.models.Card
  }

  let CardSchema = Mongoose.Schema(CardLayout, {timestamps: true, discriminatorKey: 'type'});
  CardSchema.loadClass(CardClass)

  CardSchema.post('save', function (options, next) {
    if (options._history) {
      options._historyLastSetStore(this._history, this._lastSet).then(() => {
        next()
      })
    } else {
      next()
    }
  })
  let CardModel = db.model('Card', CardSchema)

  // -- setting up the history
  //let CardHistorySchema = new Schema(CardHistoryLayout, {timestamps: true})
  // session.CardHistory = session.ProjectCon.model('CardHistory', CardHistorySchema)
  let CardHistorySchema = Mongoose.Schema(CardHistoryLayout)
  let CardHistory = db.model('CardHistory', CardHistorySchema)


  let CardFileSchema = Mongoose.Schema(CardFileLayout, {discriminatorKey: 'type'})
  CardFileSchema.virtual('stream')
    .get(function(value, virtual, doc) {
      let filename = Path.join(__dirname, '..', Config.get('Path.dataRoot'), doc._id.toString() )
      return Fs.createReadStream(filename)
    })

  CardFileSchema.pre('save', function(next, options) {
    if (this.isNew) {
      if (!Fs.existsSync(this.filename)) {
        throw new Error('filename is required and must exist')
      }
      let filename = this.filename
      let toFilename = Path.join(__dirname, '..', Config.get('Path.dataRoot'), this._id.toString() )
      Fs.copyFileSync(filename, toFilename)
      let stats = Fs.statSync(toFilename)
      this.set({size: stats.size, filename: Path.basename(this.filename), mimeType: Mime.lookup(filename)})
      if (Config.get('Card.File.removeImport')) {
        Fs.unlinkSync(filename)
      }
    }
    next()
  })
  // session.CardFile = session.ProjectCon.model('Card').discriminator('File', CardFileSchema)
  // TODO this does not work anymore WHY????
  // try {
  //   let CardFile = db.model('Card').discriminator('type', CardFileSchema)
  // } catch(e) {
  //   throw e
  // }
  //session.ProjectCon.model('CardFile', CardFileSchema)

  return CardModel
}

module.exports = CardDef

