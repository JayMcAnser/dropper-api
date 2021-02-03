
/**
 * testing the auth controller
 */

const Init = require('./init-test');
const chai = require('chai');
const chaiHttp = require('chai-http'); //types');
chai.use(chaiHttp);
const assert = chai.assert;

const Const = require('../lib/const');
const server = 'http://localhost:3000';
const ROOT = '/auth';

const AuthController = require('../controllers/auth')

describe('auth-controller', () => {

  describe('direct', () => {
    it('validate user', async() => {
      let req = {
        headers: {'authorization': await Init.AuthToken},
        body : {}
      }
      let res = {
        obj: {},
        json: function(obj) { this.obj = obj}
      }
      let result = await AuthController.validate(
        req,
        res,
        () => {});
//      assert.equal(res.obj.status, Const.status.success, res.obj.message);
      assert.isDefined(req.body.user);
      assert.equal(req.body.user.email, Init.AuthEmail);
    });


    it('validate user - wrong token', async() => {
      let req = {
        headers: {'authorization': 'WRONG TOKEN'},
        body : {}
      }
      let res = {
        obj: {},
        json: function(obj) { this.obj = obj}
      }
      let result = await AuthController.validate(
        req,
        res);
      assert.isDefined(res.obj.status);
      assert.equal(res.obj.status, Const.status.error)
    });

    it('validate user - missing token', async() => {
      let req = {
        body : {}
      }
      let res = {
        obj: {},
        json: function(obj) { this.obj = obj}
      }
      let result = await AuthController.validate(
        req,
        res);
      assert.isDefined(res.obj.status);
      assert.equal(res.obj.status, Const.status.error)
    });
  });

  describe('server', () => {
    it('login user', () => {
      return chai.request(server)
        .post(ROOT)
        .type('form')
        .send({
          username: 'info@dropper.info',
          password: '12345'
        })
        .then((result) => {
          assert.equal(result.status, 200)
          assert.isDefined(result.body.data)
          assert.isDefined(result.body.data.token)
          assert.isDefined(result.body.data.user);
          assert.equal(result.body.data.user.email,'info@dropper.info')
          assert.equal(result.body.data.user.name, 'test-user')
        })
    });
    it('login user', () => {
      return chai.request(server)
        .post(ROOT)
        .type('form')
        .send({
          username: 'info@dropper.info',
          password: '--wrong--'
        })
        .then((result) => {
          assert.equal(result.status, 403)
          assert.isDefined(result.body.errors)
          assert.equal(result.body.errors.length, 1);
          assert.equal(result.body.errors[0].title, 'invalid email/password')
        })
    });

  })
})
