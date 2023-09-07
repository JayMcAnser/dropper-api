process.env.NODE_ENV = 'test';

const chai = require('chai');
const assert = chai.assert;
const dbMongo = require('../lib/db-mongo')

describe('lib.db-mongo', async() => {

  it('check connection string', () => {
    let con = dbMongo.parseConnection('Dropper')
    assert.equal(con, 'mongodb://127.0.0.1:27017/dropper-test')
    con = dbMongo.parseConnection('abadit')
    assert.equal(con, 'mongodb://127.0.0.1:27017/abadit')
  })

  it('create connection / close connection', async() => {
    try {
      let con = await dbMongo.connection()
      assert.equal(con.readyState, dbMongo.STATE_CONNECTED)
    } finally {
      assert.isTrue(await dbMongo.close())
    }
  })

})
