
const init = require('./init-test');
const chai = require('chai');
const chaiHttp = require('chai-http'); //types');
chai.use(chaiHttp);
const assert = chai.assert;

// must run init first because it load the wrong definition

const Board = require('../models/board')
const Init = require('./init-test');

const TEST_BOARD_PUBLIC = 'test.ctrl.public'
let TEST_BOARD_PUBLIC_ID;
let TEST_BOARD_PRIVATE_ID;
const TEST_BOARD_PRIVATE = 'test.ctrl.private'
const server = 'http://localhost:3000';
const ROOT = '/public';
const Const = require('../lib/const');
const Path = require('path');
const Fs = require('fs');

const DataDir = Path.join(__dirname, 'data');


describe('controller.public', () => {

  let session;

  before(async () => {
    session = {userId: await Init.AuthUserId};
    await Board.delete(session, TEST_BOARD_PRIVATE);
    await Board.delete(session, TEST_BOARD_PUBLIC);
    let pubBoard = await Board.create(session, {name: TEST_BOARD_PUBLIC, isPublic: true, title: 'public board'})
    TEST_BOARD_PUBLIC_ID = pubBoard;
    await Board.setPublic(session, pubBoard, true);
    TEST_BOARD_PRIVATE_ID = await Board.create(session,{name: TEST_BOARD_PRIVATE, isPublic: false, title: 'private board'})
  })

  describe('general', () => {
    it('check we are running', () => {
      return chai.request(server)
        .get('/')
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data)
          assert.equal(result.body.data.message, Const.results.dropperActive)
        })
    });

    it('list the boards', () => {
      return chai.request(server)
        .get(ROOT + '/list')
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data);
          assert.isTrue(result.body.data.length > 0, 'should find our test file');
          assert.isTrue(result.body.data.findIndex((b) => b.name === TEST_BOARD_PUBLIC) >= 0)
          assert.isTrue(result.body.data.findIndex((b) => b.name === TEST_BOARD_PRIVATE) < 0)
        })
    });

    it('open - public', () => {
      return chai.request(server)
        .get(ROOT + '/open/' + TEST_BOARD_PUBLIC)
        .then((result) => {

          assert.equal(result.status, 200)
          assert.isDefined(result.body.data)
          assert.isDefined(result.body.data.id);
          assert.equal(result.body.data.name, TEST_BOARD_PUBLIC)
        })
    });

    it('openById - public', () => {
      return chai.request(server)
        .get(ROOT + '/openById/' + TEST_BOARD_PUBLIC_ID)
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data);
          assert.equal(result.body.data.name, TEST_BOARD_PUBLIC)
        })
    });
    it('open - block private', () => {
      return chai.request(server)
        .get(ROOT + '/open/' + TEST_BOARD_PRIVATE)
        .then((result) => {
          assert.equal(result.status, 403)
          assert.equal(result.body.errors.length, 1)
          assert.equal(result.body.errors[0].title, Const.results.accessDenied);
          assert.equal(result.body.errors[0].status, 403)
        })
    });
  });

  describe('image', () => {
    let PUB_IMAGE_ID;
    let PRIV_IMAGE_ID;
    const CONTENT = 'dummy data';

    before( async() => {
      // create the two dummy files
      let filename =  Path.join(DataDir, 'image.png')
      Fs.writeFileSync(filename,CONTENT);
      PUB_IMAGE_ID = await Board.imageAdd(session, {id: TEST_BOARD_PUBLIC_ID}, filename)
      Fs.writeFileSync(filename,CONTENT);
      PRIV_IMAGE_ID = await Board.imageAdd(session, {id: TEST_BOARD_PRIVATE_ID}, filename)
    });

    it('read public - ok', () => {
      return chai.request(server)
        .get(ROOT + `/image/${TEST_BOARD_PUBLIC_ID}/${PUB_IMAGE_ID}`)
        .then((result) => {
          assert.equal(result.status, 200)
          assert.equal(Buffer.from(result.body).toString(), CONTENT, 'the same data')
        })
    })

    it('read public - wrong image id', () => {
      return chai.request(server)
        .get(ROOT + `/image/${TEST_BOARD_PUBLIC_ID}/${PUB_IMAGE_ID + 'AA'}`)
        .then((result) => {
          assert.equal(result.status, 404)
          assert.isDefined(result.body.errors);
          assert.equal(result.body.errors.length, 1);
          assert.equal(result.body.errors[0].title, Const.results.imageNotFound)
        })
    });

    it('read public - no image', () => {
      return chai.request(server)
        .get(ROOT + `/image/${TEST_BOARD_PUBLIC_ID}`)
        .then((result) => {
          assert.equal(result.status, 404)
          assert.isDefined(result.body.errors);
          assert.equal(result.body.errors.length, 1);
          assert.equal(result.body.errors[0].title, Const.results.urlNotFound)
        })
    });

    it('read private - image', () => {
      return chai.request(server)
        .get(ROOT + `/image/${TEST_BOARD_PRIVATE_ID}/${PRIV_IMAGE_ID}`)
        .then((result) => {
          assert.equal(result.status, 403)
          assert.isDefined(result.body.errors);
          assert.equal(result.body.errors.length, 1);
          assert.equal(result.body.errors[0].title, Const.results.accessDenied)
        })
    })

  })
});
