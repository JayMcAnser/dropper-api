process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;

describe('test', () => {

  it ('multi connection', async() => {
    var mongoose = require('mongoose')
    var conn = mongoose.createConnection('mongodb://localhost/db1');
    var conn2 = mongoose.createConnection('mongodb://localhost/db2');
    var Schema = new mongoose.Schema({})
    var model1 = conn.model('User', Schema);
    var model2 = conn2.model('Item', Schema);
    let a = await model1.find({})
    let b = await model2.find({})
  })
})
