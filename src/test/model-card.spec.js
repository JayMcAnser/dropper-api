process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const DbMongo = require('../lib/db-mongo')
const Config = require('config')
const Path = require("path");
const {CardFileModel: CardFile} = require("../model/card");
const Setup = require('./test.setup')

async function streamToString(stream) {
  // lets have a ReadableStream as a stream variable
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

describe('model-card-2', async() => {
  let dbSystem
  let Models // the models IN the system db
  let user

  const USERNAME = 'c' + Config.get('Test.username')
  const PASSWORD = 'c' + Config.get('Test.password')
  const EMAIL = 'c' + Config.get('Test.email')

  before(async () => {
    dbSystem = await DbMongo.connection('dropper-user-test')//  Models = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})
    Models = dbSystem.models
    user = await Setup.createUser()
  })

  it('create Card', async () => {
    assert.isDefined(user._id, 'must have a user')
    const CardDef = require('../model/card')
    let CardModel = await CardDef(dbSystem)
    let card = await CardModel.create({title: 't1', ownerId: user._id})
    await card.save();
    assert.isDefined(card._id)
    let c2 = await CardModel.findOne({title: 't1'})
    assert.equal(card._id.ObjectId, c2._id.ObjectId, 'should find it')
  })
  describe('update', async () => {
    it('user field base with history', async () => {
      let card = await Models.Card.create({title: 't2.1', content: 'the content', ownerId: user._id})
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.title = 't2.2'
      cardVal.type = 'file'  // will not be stored
      // this activates the history runner
      await card.assign(Models, cardVal) // {ownerId: Models.userId})
      await card.save()
      let c2 = await Models.Card.findById(card._id)
      assert.equal(c2.title, 't2.2')
      assert.equal(c2.type, 'Card', 'type is not allowed to change')

      cardVal = await c2.makeObject()
      // test splitting of the steps
      c2.expireTime = 1

      cardVal.title = 't2.3'
      await c2.assign(Models, cardVal)
      await c2.save()
      c2 = await Models.Card.findById(card._id)
      assert.equal(c2.title, 't2.3')

      assert.equal(await c2.historyCount(Models), 2)
    })
    it('user field with history', async() => {
      let card = await Models.Card.create({ title : 't3.1', content: 'the content', ownerId: user._id})
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w1'
      // this activates the history runner
      await card.assign(Models, cardVal)
      await card.save()

      // this should create a history with a step where fields.work is w1
      let card2 = await Models.Card.findById(card._id)
      let c2 = card2.makeObject()
      assert.equal(c2.fields.work, 'w1')
      c2.fields.work = 'w2'
      assert.equal(card2.fields.work, 'w1')
      await card2.assign(Models, c2)
      await card2.save()
      // check the update has been done
      card = await Models.Card.findById(card._id)
      c2 = card.makeObject()
      assert.equal(c2.fields.work, 'w2')

      let cnt = await card.historyCount(Models)
      assert.equal(cnt, 1)
    })
  })

  describe('history', async() => {
    it('history previous version', async () => {
      let card = await Models.Card.create({
        title: 't4.0',
        content: 'the content',
        fields: {work: 'w4.0'},
        ownerId: user._id
      })
      card.expireTime = 1
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w4.1'
      cardVal.fields.toRemove = 'w4.1'
      cardVal.title = 't4.1'
      // this activates the history runner
      await card.assign(Models, cardVal)
      await card.save()

      // make a next version
      cardVal.fields.work = 'w4.2'
      cardVal.title = 't4.2'
      await card.assign(Models, cardVal)
      await card.save()

      assert.equal(await card.historyCount(Models), 2, 'the two changes')

      // direct access to current state
      let cardVal2 = await card.history(Models, 0)
      assert.equal(cardVal2.fields.work, 'w4.2')
      assert.equal(cardVal2.fields.toRemove, 'w4.1')

      // 0 == current state
      cardVal2 = await card.history(Models, 0)
      assert.equal(cardVal2.fields.work, 'w4.2')

      // access to previous state
      cardVal2 = await card.history(Models, 1)
      assert.equal(cardVal2.fields.work, 'w4.1')

      // .length is access to the original created version
      cardVal2 = await card.history(Models, 2)
      assert.equal(cardVal2.fields.work, 'w4.0')
      // the in between created field (create in step1) should be removed from the field section
      assert.isUndefined(cardVal2.fields.toRemove, 'field did not exist when created')
    })

    it ('undo', async() => {
      let card = await Models.Card.create({ title : 't5.0', content: 'the content', fields: {work: 'w5.0'},  ownerId: user._id})
      card.expireTime = 1
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w5.1'
      cardVal.fields.toRemove = 'w5.1'
      cardVal.title = 'w5.1'
      // this activates the history runner
      await card.assign(Models, cardVal)
      await card.save()

      // make a next version
      cardVal.fields.work = 'w5.2'
      cardVal.title = 'w5.2'
      await card.assign(Models, cardVal)
      await card.save()

      assert.equal(await card.historyCount(Models), 2, 'the two changes')

      await card.undo(Models,0)
      await card.save()
      assert.equal(await card.historyCount(Models), 3, 'Undo to the current step is not an undo')

      await card.undo(Models,1)
      await card.save()
      assert.equal(await card.historyCount(Models), 4, 'Undo add step to the history')

      let c2 = await Models.Card.findById(card._id)
      let c2Data = await c2.makeObject()
      assert.equal(c2Data.fields.work, 'w5.2')
    })
  })
  describe('relations', async() => {
    let cMaster

    it('adding child', async () => {
      cMaster = await Models.Card.create({title: 'm6.0', content: 'master', fields: {work: 'm6.0'}, ownerId: user._id})

      let cChild1 = await Models.Card.create({
        title: 'c6.1',
        content: 'child',
        fields: {work: 'c6.1'},
        ownerId: user._id
      })
      let cChild2 = await Models.Card.create({
        title: 'c6.2',
        content: 'child',
        fields: {work: 'c6.2'},
        ownerId: user._id
      })

      cMaster.expireTime = 1  // every step is a history step
      assert.equal(cMaster.children().length, 0)
      assert.equal(await cMaster.historyCount(Models), 0, 'create')
      // add and undo the child to the master
      await cMaster.children().add(Models, cChild1, {forceStep: true}) // group the coming steps
      await cMaster.save()
      assert.equal(await cMaster.historyCount(Models), 1, 'create, add')
      assert.equal(cMaster.children().length, 1)
      await cMaster.undo(Models,1)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(Models), 2, 'create, add', 'undo')
      assert.equal(cMaster.children().length, 0)

      await cMaster.children().add(Models, cChild1)
      await cMaster.save();
      assert.equal(await cMaster.historyCount(Models), 3, 'create, add', 'undo', 'add1')
      assert.equal(cMaster.children().length, 1, 'element can only be added once')
      await cMaster.children().add(Models, cChild2)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(Models), 4, 'create, add', 'undo', 'add1', 'add2')
      assert.equal(cMaster.children().length, 2,)

      let cm = await Models.Card.findById(cMaster._id)
      assert.equal(cm.children().length, 2,)
      // direct access to the children
      let c1 = await cm.child(Models, 0)
      assert.equal(c1.title, cChild1.title)


      cm = await Models.Card.findById(cMaster._id)
      assert.equal(cm.children().length, 2, 'we did store it')

      // try to undo it
      await cMaster.undo(Models, 1)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(Models), 5, 'create, add', 'undo', 'add1', 'add2', 'undo')

      assert.equal(cMaster.children().length, 1)

      assert.isTrue(await cMaster.children().delete(Models, 0))
      let c3 = await Models.Card.findById(cMaster._id)
      assert.equal(c3.children().length, 1, 'not yet stored on disk')
      await cMaster.save()

      assert.equal(await cMaster.historyCount(Models), 6, 'create, add', 'undo', 'add1', 'add2', 'undo', 'delete')
      assert.equal(cMaster.children().length, 0)
    })

    it('move them around', async () => {
      let cMaster = await Models.Card.create({title: 'm7.0', content: 'master', fields: {work: 'm7.0'}, ownerId: user._id})
      cMaster.expireTime = 1

      let cChild1 = await Models.Card.create({
        title: 'c7.1',
        content: 'child',
        fields: {work: 'c7.1'},
        ownerId: user._id
      })
      await cMaster.children().add(Models, cChild1)
      await cMaster.save()
      assert.equal(cMaster.children().length, 1)

      let cChild2 = await Models.Card.create({
        title: 'c7.2',
        content: 'child',
        fields: {work: 'c7.2'},
        ownerId: user._id
      })
      await cMaster.children().add(Models, cChild2)
      await cMaster.save()
      assert.equal(cMaster.children().length, 2)
      // add some more elements
      let cChild3 = await Models.Card.create({
        title: 'c7.3',
        content: 'child',
        fields: {work: 'c7.3'},
        ownerId: user._id
      })
      await cMaster.children().add(Models, cChild3)
      await cMaster.save()
      let cChild4 = await Models.Card.create({
        title: 'c7.4',
        content: 'child',
        fields: {work: 'c7.4'},
        ownerId: user._id
      })
      await cMaster.children().add(Models, cChild4)
      await cMaster.save()

      let c = [];
      // validate our set
      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(Models, index)).title
      }
      assert.deepEqual(c, ["c7.1", "c7.2", "c7.3", "c7.4"])

      // move 0 to 2
      await cMaster.children().move(Models, 0, 2)
      await cMaster.save()
      assert.equal((await cMaster.child(Models, 0)).title, 'c7.2')

      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(Models, index)).title
      }
      assert.deepEqual(c, ["c7.2", "c7.1", "c7.3", "c7.4"])

      // and back again
      await cMaster.children().move(Models, 2, 0)
      await cMaster.save()
      for (let index = 0; index < cMaster.children(Models ).length; index++) {
        c[index] = (await cMaster.child(Models, index)).title
      }
      assert.deepEqual(c, ["c7.3", "c7.2", "c7.1", "c7.4"])

      // and last postion again
      await cMaster.children().move(Models, 3, 0)
      await cMaster.save()
      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(Models, index)).title
      }
      assert.deepEqual(c, ["c7.4", "c7.3", "c7.2", "c7.1"])


      // undo our move
      assert.equal(await cMaster.historyCount(Models ), 7,)
      await cMaster.undo(Models,1)
      await cMaster.save()

      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(Models, index)).title
      }
      assert.deepEqual(c, ["c7.3", "c7.2", "c7.1", "c7.4"])
    })
  })

  // todo: This temporary disable. See /model/card for error
  // describe('file', async() => {
  //   let filename = Path.join(__dirname, 'temp', 'test.txt')
  //   it('create - test history of basic card', async() => {
  //     cMaster = await Models.File.create({title: 'fm1.0',  filename, fields: {work: 'f6.0'}, ownerId: user._id})
  //     assert.equal(cMaster.filename, 'test.txt')
  //     assert.equal(cMaster.mimeType, 'text/plain')
  //     assert.equal(cMaster.type, 'File')
  //     // test card functionality
  //     let mData = await cMaster.makeObject()
  //     mData.fields.someInfo = 'From the file'
  //     cMaster.assign(Models, mData)
  //     await cMaster.save()
  //     assert.equal(cMaster.history.length, 1)
  //   })
  //
  //   it('stream get', async() => {
  //     cMaster = await Models.File.create({title: 'fm2.0',  filename, ownerId: user._id})
  //     assert.isDefined(cMaster.stream)
  //     let s = await streamToString(cMaster.stream)
  //     assert.equal(s.length, cMaster.size)
  //   })
  // })
})
