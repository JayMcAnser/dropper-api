const Init = require('./init-test');
const chai = require('chai');
const assert = chai.assert;
const ApiReturn = require('../lib/api-return')

let res = {
  _json: false,
  _status: false,
  json: function(data) {
    this._json = data;
  },
  status(val) {
    this._status = val;
  },
  _headers: {},
  setHeader: function(key, value) {
    this._headers[key] = value
  }
}
let req = {
  session: {
    _type: false,
    _message: false,
    log: function(type, msg) {
      this._type = type;
      this._message = msg;
    }
  }
}

const clean = (obj) => {
  for (let key in obj) {
    if (!obj.hasOwnProperty(key)) { continue }
    if (typeof obj[key] === 'object') {
      obj[key] = clean(obj[key])
    } else if (typeof obj[key] === 'array') {
      obj[key] = []  
    } else if (key[0] === '_') {
      obj[key] = false;
    }
  }
  return obj;
}


describe('api-return', () => {

  it('result', () => {
    let result = ApiReturn.result(clean(req), clean(res), {test: 'some'});
    assert.equal(res._status, 200)
    assert.equal(req.session._type, false, 'no info logger')    
    result = ApiReturn.result(clean(req), clean(res), {test: 'some'}, 'log message');    
    assert.equal(req.session._type, 'info')    
    assert.equal(req.session._message, 'log message')
    result = ApiReturn.result(clean(req), clean(res), {rec: 'the result'}, 201);
    assert.equal(res._status, 201, 'status can be set')
    result = ApiReturn.result(clean(req), clean(res), {rec: 'the result'}, 'did find', 201);
    assert.equal(res._status, 201, 'status can be set')
    assert.equal(req.session._type, 'info')
    assert.equal(req.session._message, 'did find')
    result = ApiReturn.result(clean(req), clean(res), {rec: 'the result'}, {type: 'warn', message: 'did find'}, 201);
    assert.equal(req.session._type, 'warn', 'can set the type of logging')
    assert.equal(req.session._message, 'did find')
    result = ApiReturn.result(clean(req), clean(res), {rec: 'the result'}, {text: 'test'}, 201);
    assert.equal(req.session._type, 'info');
    assert.deepEqual(req.session._message, {text: 'test'})
  })

  it('error result - normal', () => {
    ApiReturn.error(clean(req), clean(res), new Error('the message'));
    assert.equal(res._status, 500)
    assert.deepEqual(res._json, {errors: [{status: 500, title: 'the message'}]})
    assert.equal(req.session._type, 'error', 'default is error')  
    assert.equal(req.session._message, 'the message')
  });
  it('error result - location', () => {
    ApiReturn.error(clean(req), clean(res), new Error('the message'), '[test]');
    assert.equal(res._status, 500)
    
    assert.equal(req.session._type, 'error', 'default is error')  
    assert.equal(req.session._message, '[test] the message')
  });

  it('error result - status', () => {
    ApiReturn.error(clean(req), clean(res), new Error('the message'), 501);
    assert.equal(res._status, 501)
  });
})