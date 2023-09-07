/**
 *
 * Mongo connections
 * version 2 @jay 23023-08-30
 *
 */
const Config = require('config');
const Mongoose = require('mongoose');

const DropperKey = 'Dropper'
const connections = {}


module.exports = {
  /**
   *
   * @param key String
   * @return {string}
   */
  parseConnection(key) {
    let dbKey = (key === DropperKey) ? 'Dropper' : 'Card'
    let connectionString = 'mongodb://'
    if (Config.get(`Database.${dbKey}.username`).length > 0) {
      connectionString += Config.get(`Database.${dbKey}.username`)
      if (Config.get(`Database.${dbKey}.password`).length) {
        connectionString += ':' + Config.get(`Database.${dbKey}.password`)
      }
      connectionString += '@'
    }
    connectionString += Config.get(`Database.${dbKey}.host`) + ':' + Config.get(`Database.${dbKey}.port`) + '/'
    return connectionString + (key === DropperKey ? Config.get('Database.Dropper.name') : key)
  },

  /**
   * finds a suitable connection
   * @param name: String
   * @return {<Mongoose.NativeConnection>}
   */
  async connection(name = DropperKey) {
    if (!connections[name]) {
      // new connection
      let connectionString = this.parseConnection(name)
      connections[name] = {
        connection: await Mongoose.createConnection(connectionString).asPromise(),
        count: 1
      }
    } else {
      connections[name].count++
    }
    return connections[name].connection
  },

  /**
   * close a connection and removes all info from it
   *
   * @param name
   * @param force
   * @return {Promise<boolean>} Was there a connection?
   */
  async close(name = DropperKey, force = false) {
    if (connections[name]) {
      connections[name].count--
      if (connections[name] <= 0) {
        await connections[name].close(force)
        delete connections[name]
      }
      return true
    }
    return false
  },

  // constant definitions
  STATE_CONNECTED: 1,
  STATE_DISCONNECTED: 0
}
