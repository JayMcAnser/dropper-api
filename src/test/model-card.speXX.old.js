process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const DbMongo = require('../lib/db-mongo')
const Config = require('config')
const Path = require("path");
const {CardFileModel: CardFile} = require("../model/card");


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

  const USERNAME = 'c' + Config.get('Test.username')
  const PASSWORD = 'c' + Config.get('Test.password')
  const EMAIL = 'c' + Config.get('Test.email')

  before(async () => {
    dbSystem = await DbMongo.connection('dropper-user-test')//  session = new Session({email: EMAIL, username: USERNAME, password: PASSWORD})

  })

  it('create Card', async () => {
    const CardDef = require('../model/card')
    assert.isDefined(session.ProjectCon)
    let CardModel = await CardDef(session)
    let card = await CardModel.create({title: 't1', ownerId: session.userId})
    await card.save();
    assert.isDefined(card._id)
    let c2 = await CardModel.findOne({title: 't1'})
    assert.equal(card._id.ObjectId, c2._id.ObjectId, 'should find it')
  })
  describe('update', async () => {
    it('user field base with history', async () => {
      let card = await session.Card.create({title: 't2.1', content: 'the content', ownerId: session.userId})
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.title = 't2.2'
      cardVal.type = 'file'  // will not be stored
      // this activates the history runner
      await card.assign(session, cardVal) // {ownerId: session.userId})
      await card.save()
      let c2 = await session.Card.findById(card._id)
      assert.equal(c2.title, 't2.2')
      assert.equal(c2.type, 'Card', 'type is not allowed to change')

      cardVal = await c2.makeObject()
      // test splitting of the steps
      c2.expireTime = 1

      cardVal.title = 't2.3'
      await c2.assign(session, cardVal)
      await c2.save()
      c2 = await session.Card.findById(card._id)
      assert.equal(c2.title, 't2.3')

      assert.equal(await c2.historyCount(session), 2)
    })
    it('user field with history', async() => {
      let card = await session.Card.create({ title : 't3.1', content: 'the content', ownerId: session.userId})
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w1'
      // this activates the history runner
      await card.assign(session, cardVal)
      await card.save()

      // this should create a history with a step where fields.work is w1
      let card2 = await session.Card.findById(card._id)
      let c2 = card2.makeObject()
      assert.equal(c2.fields.work, 'w1')
      c2.fields.work = 'w2'
      assert.equal(card2.fields.work, 'w1')
      await card2.assign(session, c2)
      await card2.save()
      // check the update has been done
      card = await session.Card.findById(card._id)
      c2 = card.makeObject()
      assert.equal(c2.fields.work, 'w2')

      let cnt = await card.historyCount(session)
      assert.equal(cnt, 1)
    })
  })

  describe('history', async() => {
    it('history previous version', async () => {
      let card = await session.Card.create({
        title: 't4.0',
        content: 'the content',
        fields: {work: 'w4.0'},
        ownerId: session.userId
      })
      card.expireTime = 1
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w4.1'
      cardVal.fields.toRemove = 'w4.1'
      cardVal.title = 't4.1'
      // this activates the history runner
      await card.assign(session, cardVal)
      await card.save()

      // make a next version
      cardVal.fields.work = 'w4.2'
      cardVal.title = 't4.2'
      await card.assign(session, cardVal)
      await card.save()

      assert.equal(await card.historyCount(session), 2, 'the two changes')

      // direct access to current state
      let cardVal2 = await card.history(session, 0)
      assert.equal(cardVal2.fields.work, 'w4.2')
      assert.equal(cardVal2.fields.toRemove, 'w4.1')

      // 0 == current state
      cardVal2 = await card.history(session, 0)
      assert.equal(cardVal2.fields.work, 'w4.2')

      // access to previous state
      cardVal2 = await card.history(session, 1)
      assert.equal(cardVal2.fields.work, 'w4.1')

      // .length is access to the original created version
      cardVal2 = await card.history(session, 2)
      assert.equal(cardVal2.fields.work, 'w4.0')
      // the in between created field (create in step1) should be removed from the field section
      assert.isUndefined(cardVal2.fields.toRemove, 'field did not exist when created')
    })

    it ('undo', async() => {
      let card = await session.Card.create({ title : 't5.0', content: 'the content', fields: {work: 'w5.0'},  ownerId: session.userId})
      card.expireTime = 1
      // create a clean object to work with
      let cardVal = (await card.save()).makeObject();
      cardVal.fields.work = 'w5.1'
      cardVal.fields.toRemove = 'w5.1'
      cardVal.title = 'w5.1'
      // this activates the history runner
      await card.assign(session, cardVal)
      await card.save()

      // make a next version
      cardVal.fields.work = 'w5.2'
      cardVal.title = 'w5.2'
      await card.assign(session, cardVal)
      await card.save()

      assert.equal(await card.historyCount(session), 2, 'the two changes')

      await card.undo(session,0)
      await card.save()
      assert.equal(await card.historyCount(session), 3, 'Undo to the current step is not an undo')

      await card.undo(session,1)
      await card.save()
      assert.equal(await card.historyCount(session), 4, 'Undo add step to the history')

      let c2 = await session.Card.findById(card._id)
      let c2Data = await c2.makeObject()
      assert.equal(c2Data.fields.work, 'w5.2')
    })
  })
  describe('relations', async() => {
    let cMaster

    it('adding child', async () => {
      cMaster = await session.Card.create({title: 'm6.0', content: 'master', fields: {work: 'm6.0'}, ownerId: session.userId})

      let cChild1 = await session.Card.create({
        title: 'c6.1',
        content: 'child',
        fields: {work: 'c6.1'},
        ownerId: session.userId
      })
      let cChild2 = await session.Card.create({
        title: 'c6.2',
        content: 'child',
        fields: {work: 'c6.2'},
        ownerId: session.userId
      })

      cMaster.expireTime = 1  // every step is a history step
      assert.equal(cMaster.children().length, 0)
      assert.equal(await cMaster.historyCount(session), 0, 'create')
      // add and undo the child to the master
      await cMaster.children().add(session, cChild1, {forceStep: true}) // group the coming steps
      await cMaster.save()
      assert.equal(await cMaster.historyCount(session), 1, 'create, add')
      assert.equal(cMaster.children().length, 1)
      await cMaster.undo(session,1)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(session), 2, 'create, add', 'undo')
      assert.equal(cMaster.children().length, 0)

      await cMaster.children().add(session, cChild1)
      await cMaster.save();
      assert.equal(await cMaster.historyCount(session), 3, 'create, add', 'undo', 'add1')
      assert.equal(cMaster.children().length, 1, 'element can only be added once')
      await cMaster.children().add(session, cChild2)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(session), 4, 'create, add', 'undo', 'add1', 'add2')
      assert.equal(cMaster.children().length, 2,)

      let cm = await session.Card.findById(cMaster._id)
      assert.equal(cm.children().length, 2,)
      // direct access to the children
      let c1 = await cm.child(session, 0)
      assert.equal(c1.title, cChild1.title)


      cm = await session.Card.findById(cMaster._id)
      assert.equal(cm.children().length, 2, 'we did store it')

      // try to undo it
      await cMaster.undo(session, 1)
      await cMaster.save()
      assert.equal(await cMaster.historyCount(session), 5, 'create, add', 'undo', 'add1', 'add2', 'undo')

      assert.equal(cMaster.children().length, 1)

      assert.isTrue(await cMaster.children().delete(session, 0))
      let c3 = await session.Card.findById(cMaster._id)
      assert.equal(c3.children().length, 1, 'not yet stored on disk')
      await cMaster.save()

      assert.equal(await cMaster.historyCount(session), 6, 'create, add', 'undo', 'add1', 'add2', 'undo', 'delete')
      assert.equal(cMaster.children().length, 0)
    })

    it('move them around', async () => {
      let cMaster = await session.Card.create({title: 'm7.0', content: 'master', fields: {work: 'm7.0'}, ownerId: session.userId})
      cMaster.expireTime = 1

      let cChild1 = await session.Card.create({
        title: 'c7.1',
        content: 'child',
        fields: {work: 'c7.1'},
        ownerId: session.userId
      })
      await cMaster.children().add(session, cChild1)
      await cMaster.save()
      assert.equal(cMaster.children().length, 1)

      let cChild2 = await session.Card.create({
        title: 'c7.2',
        content: 'child',
        fields: {work: 'c7.2'},
        ownerId: session.userId
      })
      await cMaster.children().add(session, cChild2)
      await cMaster.save()
      assert.equal(cMaster.children().length, 2)
      // add some more elements
      let cChild3 = await session.Card.create({
        title: 'c7.3',
        content: 'child',
        fields: {work: 'c7.3'},
        ownerId: session.userId
      })
      await cMaster.children().add(session, cChild3)
      await cMaster.save()
      let cChild4 = await session.Card.create({
        title: 'c7.4',
        content: 'child',
        fields: {work: 'c7.4'},
        ownerId: session.userId
      })
      await cMaster.children().add(session, cChild4)
      await cMaster.save()

      let c = [];
      // validate our set
      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(session, index)).title
      }
      assert.deepEqual(c, ["c7.1", "c7.2", "c7.3", "c7.4"])

      // move 0 to 2
      await cMaster.children().move(session, 0, 2)
      await cMaster.save()
      assert.equal((await cMaster.child(session, 0)).title, 'c7.2')

      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(session, index)).title
      }
      assert.deepEqual(c, ["c7.2", "c7.1", "c7.3", "c7.4"])

      // and back again
      await cMaster.children().move(session, 2, 0)
      await cMaster.save()
      for (let index = 0; index < cMaster.children(session ).length; index++) {
        c[index] = (await cMaster.child(session, index)).title
      }
      assert.deepEqual(c, ["c7.3", "c7.2", "c7.1", "c7.4"])

      // and last postion again
      await cMaster.children().move(session, 3, 0)
      await cMaster.save()
      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(session, index)).title
      }
      assert.deepEqual(c, ["c7.4", "c7.3", "c7.2", "c7.1"])


      // undo our move
      assert.equal(await cMaster.historyCount(session ), 7,)
      await cMaster.undo(session,1)
      await cMaster.save()

      for (let index = 0; index < cMaster.children().length; index++) {
        c[index] = (await cMaster.child(session, index)).title
      }
      assert.deepEqual(c, ["c7.3", "c7.2", "c7.1", "c7.4"])
    })
  })

  describe('file', async() => {
    let filename = Path.join(__dirname, 'temp', 'test.txt')
    it('create - test history of basic card', async() => {
      cMaster = await session.CardFile.create({title: 'fm1.0',  filename, fields: {work: 'f6.0'}, ownerId: session.userId})
      assert.equal(cMaster.filename, 'test.txt')
      assert.equal(cMaster.mimeType, 'text/plain')
      assert.equal(cMaster.type, 'File')
      // test card functionality
      let mData = await cMaster.makeObject()
      mData.fields.someInfo = 'From the file'
      cMaster.assign(session, mData)
      await cMaster.save()
      assert.equal(cMaster.history.length, 1)
    })

    it('stream get', async() => {
      cMaster = await session.CardFile.create({title: 'fm2.0',  filename, ownerId: session.userId})
      assert.isDefined(cMaster.stream)
      let s = await streamToString(cMaster.stream)
      assert.equal(s.length, cMaster.size)
    })
  })
})
