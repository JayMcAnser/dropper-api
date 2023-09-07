/**
 * basic session class
 */

const Factory = require('./factory')
const MongoDb = require('./db-mongo')
const RIGHTS_READ = 1;
const RIGHTS_WRITE = 2;
const RIGHTS_DELETE = 4;
const RIGHTS_EXPORT = 8;
const RIGHTS_ADMIN = 16

class Session {

  constructor(options= {}) {
    this._sysemDb = false
    console.log('CREATE SESSION')
  }

  async init(userId) {
    this.userId = userId
    let UserModel = Factory.create('user')
    this.user = await UserModel.findById(userId)
    this._sysemDb = await MongoDb.connection()
  }

  get systemDb() {
    if (!this._systemDb) {
      throw new Error('no system db')
    }
    return this._sysemDb
  }
  // /**
  //  * returns true if the user can read this type information
  //  * or the user is sysAdmin
  //  * @param type
  //  * @return {boolean}
  //  */
  // canRead(type) {
  //   if (this.isAdmin) {
  //     return true;
  //   }
  //   let module = this.rights.filter((x) => x.module === type && x.rights & RIGHTS_READ === RIGHTS_READ);
  //   return module.length > 0
  // }
  //
  // canWrite(type) {
  //   if (this.isAdmin) {
  //     return true;
  //   }
  //   let module = this.rights.filter((x) => x.module === type && x.rights & RIGHTS_WRITE === RIGHTS_WRITE);
  //   return module.length > 0
  // }
}

module.exports = Session;
