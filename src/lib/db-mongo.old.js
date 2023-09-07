/**
 * global access to the mongodb
 */
const Mongoose = require('mongoose');
const Config = require('config');
const Logging = require('../lib/logging');
const Bcrypt = require('bcryptjs');

const RIGHTS_READ = 1;
const RIGHTS_WRITE = 2;
const RIGHTS_DELETE = 4;
const RIGHTS_EXPORT = 8;
const RIGHTS_ADMIN = 16

let DbMongo  = {

  /**
   * open an user specific database or the dropper system db
   * @param key String (Dropper, UUID of database
   * @return {Promise<*>}
   */
  connection(key = 'Dropper') {
    // Mongoose.set('bufferCommands', false);
    let dbKey = key
    let dbName
    let connectionString
    if (!Config.has(`Database.${key}`)) {
      dbKey = 'User'
      dbName = key
    } else {
      dbKey = 'Dropper'
      dbName = Config.get(`Database.${dbKey}.name`)
    }

    connectionString = Config.get(`Database.${dbKey}.host`)
    if (Config.has(`Database.${dbKey}.port`)) {
      connectionString += ':' + Config.get(`Database.${dbKey}.port`)
    }
    connectionString += '/' + dbName.toLowerCase();
    if (Config.has(`Database.${dbKey}.uriParam`) && Config.get(`Database.${dbKey}.uriParam`)) {
      connectionString += '?' + Config.get(`Database.${dbKey}.uriParam`)
    }

    if (Config.has(`Database.${dbKey}.username`) && Config.get(`Database.${dbKey}.username`)) {
      let pwd = Config.get(`Database.${dbKey}.password`);
      if (pwd) {
        connectionString = `${Config.get(`Database.${dbKey}.username`)}:${Config.get(`Database.${dbKey}Mongo.password`)}@${connectionString}`
      } else {
        connectionString = `${Config.get(`Database.${dbKey}.username`)}@${connectionString}`
      }
    }
    if (Config.has(`Database.${dbKey}.prefix`) && Config.get(`Database.${dbKey}.prefix`)) {
      connectionString = `${Config.get(`Database.${dbKey}.prefix`)}://${connectionString}`;
    }

    if (Config.get(`Database.${dbKey}.debug`)) {
      Mongoose.set('debug', true)
    }
    // Logging.log('info', `connecting to ${connectionString}`, 'dbMongo');

    // because:  DeprecationWarning: Mongoose: the `strictQuery` option will be switched back to `false` by default in Mongoose 7.
    Mongoose.set('strictQuery', false)
    // end

    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'develop') {
      console.log(`node_env = ${ process.env.NODE_ENV} - connecting to mongoDB server ${ connectionString } `)
    }
   // console.log(connectionString)
    const mongoose = require('mongoose')
    return Mongoose.createConnection(connectionString,{
            useNewUrlParser : true,
            useUnifiedTopology: true
    })

    // return {
    //   systemCon: Mongoose.createConnection(connectionString, {
    //     useNewUrlParser : true,
    //     useUnifiedTopology: true
    //   }),
    //   Schema: Mongoose.Schema,
    //   ObjectID: Mongoose.ObjectId,
    //   Types: Mongoose.Types
    //
    // }
    //
    // let x = Mongoose.connect(connectionString) //, {
    //let x = Mongoose.createConnection(connectionString) //, {
    //   useNewUrlParser : true,
    //   useUnifiedTopology: true
    // })
    //return ''
  },

  /**
   * create a connection to the database
   *
   * @param options
   * @returns {Promise}
   */
  async connect(options = {}) {

    let connectionString = Config.get('Database.Mongo.host');
    if (Config.has('Database.Mongo.port')) {
      connectionString += ':' + Config.get('Database.Mongo.port')
    }
    // connectionString += '/' + Config.get('Database.Mongo.database');
    if (Config.has('Database/Mongo/database')) {
      throw new Error('Database/Mongo/database is not an allowed key')
    }
    if (!Config.has('Database.Mongo.name')) {
      throw new Error('missing database (key: Database.Mongo.name)')
    }
    connectionString += '/' + Config.get('Database.Mongo.name');
    if (Config.has('Database.Mongo.uriParam') && Config.get('Database.Mongo.uriParam')) {
      connectionString += '?' + Config.get('Database.Mongo.uriParam')
    }


    if (Config.has('Database.Mongo.username') && Config.get('Database.Mongo.username')) {
      let pwd = Config.get('Database.Mongo.password');
      if (pwd) {
        connectionString = `${Config.get('Database.Mongo.username')}:${Config.get('Database.Mongo.password')}@${connectionString}`
      } else {
        connectionString = `${Config.get('Database.Mongo.username')}@${connectionString}`
      }
    }
    if (Config.has('Database.Mongo.prefix') && Config.get('Database.Mongo.prefix')) {
      connectionString = `${Config.get('Database.Mongo.prefix')}://${connectionString}`;
    }

    if (Config.get('Database.Mongo.debug')) {
      Mongoose.set('debug', true)
    }
    Logging.log('info', `connecting to ${connectionString}`, 'dbMongo');

    // because:  DeprecationWarning: Mongoose: the `strictQuery` option will be switched back to `false` by default in Mongoose 7.
    Mongoose.set('strictQuery', false)
    // end

    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'develop') {
      console.log(`node_env = ${ process.env.NODE_ENV} - connecting to mongoDB server ${ connectionString } `)
    }
    return Mongoose.connect(connectionString, {
      useNewUrlParser : true,
   //   reconnectTries: Number.MAX_VALUE,
   //   reconnectInterval: 1000,
      useUnifiedTopology: true
    }).then( (con) => {
      this._connection = con;
      this.con.on('error', (err) => {
        Logging.log('error', err.message, ['dbMongo.global'])
      });
      return this._connection;
    });
  },

  /**
   * get the current connection
   * @returns {Mongoose.connection|net.Socket|tls.TLSSocket|boolean|string|*}
   */
  get con() {
    return Mongoose.connection;
  },

  // /**
  //  * check that everything is ok
  //  */
  // async validateInstall() {
  //   const User = require('../model/user-model');
  //   // const SystemUser = Config.get('Database.WatsNext.root');
  //   // const SystemPassword = Config.get('Database.WatsNext.password');
  //   // there must be a user info@toxus.nl with a password
  //   return User.findOne({username: SystemUser}).then( (usr) => {
  //     if (!usr) {
  //       let saltRounds = Config.get('Security.passwordSaltRounds');
  //       return Bcrypt.hash(Config.get('Database.WatsNext.password'), saltRounds).then( (passwordHash) => {
  //         usr = new User({
  //           username: SystemUser,
  //           email:  Config.get('Database.WatsNext.email'),
  //           passwordHash: passwordHash,
  //           isActive: true,
  //           isValidated: true,
  //           isAdmin: true,
  //           rights: [
  //             {
  //              module: 'system',
  //              rights: RIGHTS_READ + RIGHTS_WRITE + RIGHTS_DELETE + RIGHTS_EXPORT + RIGHTS_ADMIN
  //             }
  //           ]
  //         })
  //         return usr.save()
  //       });
  //     }
  //     return true;
  //   });
  // }
};
module.exports = DbMongo;
module.exports.ObjectId = Mongoose.Schema.ObjectId
