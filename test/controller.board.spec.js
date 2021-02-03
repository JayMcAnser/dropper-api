const chai = require('chai');
const chaiHttp = require('chai-http'); //types');
chai.use(chaiHttp);
const assert = chai.assert;

// must run init first because it load the wrong definition
const Init = require('./init-test');
const Board = require('../models/board')
const Const = require('../lib/const');
const TEST_BOARD = 'test.ctrl'
const server = 'http://localhost:3000';


describe('controller.board', () => {

  describe('with login', () => {
    let token;
    before( async() => {
      token = await Init.AuthToken;
      let session = {userId: await Init.AuthUserId};
      await Board.delete(session, TEST_BOARD)
    })

    it('create', () => {
      return chai.request(server)
        .post('/board')
        .set('authorization', token)
        .type('form')
        .send({name: TEST_BOARD, title:'Test Board'})
        .then((result) => {
          assert.equal(result.status, 200)
          assert.equal(result.body.status, Const.status.success, result.body.message);
        })
    })

    it('open', () => {
      return chai.request(server)
        .get(`/board/${TEST_BOARD}`)
        .set('authorization', token)
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data);
          assert.equal(result.body.status, 'success', result.body.message)
          assert.equal(result.body.data.title, 'Test Board')
          assert.isDefined(result.body.data.id);
        })
    });

    it('open - not found', async () =>{
      return chai.request(server)
        .get(`/board/${TEST_BOARD + '.not-found'}`)
        .set('authorization', token)
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data);
          assert.equal(result.body.status, 'error')
          assert.equal(result.body.message, 'board not found')
        })
    })
  })


  describe('without login', () => {
    before( async() => {
      let session = {userId: await Init.AuthUserId};
      await Board.delete(session, TEST_BOARD)
    })

    it('create', () => {
      return chai.request(server)
        .post('/board')
        .type('form')
        .send({name: TEST_BOARD, title:'Test Board'})
        .then((result) => {
          assert.equal(result.status, 200)
          assert.equal(result.body.status, Const.status.error);
          assert.equal(result.body.message, Const.results.accessDenied)
        })
    })

    it('open', () => {
      return chai.request(server)
        .get(`/board/${TEST_BOARD}`)
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data);
          assert.equal(result.body.status, Const.status.error, result.body.message)
          assert.equal(result.body.message, Const.results.accessDenied);
        })
    });
  })
})
