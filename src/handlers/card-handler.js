/**
 * handle the card changes
 */

class CardHandler {
  constructor(io, socket, options = {}) {
    console.log('user connect')
    this._io = io
    this._socket = socket
  }

  init() {
    this._socket.on('card:add', (msg) => {
      console.log('add msg', msg)
      this.emit('card:upd', msg)
    })
    this._socket.on('card:upd', (msg) => {
      console.log('upd msg', msg)
      this.emit('card:upd', msg)
    })
    this._socket.on('card:del', (msg) => {
      console.log('del msg', msg)
    })
    this._socket.on('disconnect', (msg) => {
      console.log('disconnect')
    })
  }
  emit(event, msg) {
    this._socket.emit(event, msg)
  }
}

module.exports = CardHandler
