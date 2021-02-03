const boardModel = require('../models/board');
const Const = require('../lib/const');

const _getSession = function(req) {
  return {
    userId: req.session.user.id,
    log: req.session.log
  }
}

module.exports = {

  create: async function(req, res, next) {
    try {
      let board = await boardModel.create(_getSession(req), req.body)
      res.json({status: Const.status.success, message: "board created", data: board});
      req.session.log('debug', () => `[controller.board].create name: ${req.body.name}`)
    } catch(e) {
      req.session.log('error', () => `[controller.board].create ${req.body.name}, error: ${e.message}`)
      res.json({status: Const.status.error, message: e.message, data:null});
    }
  },

  open: async function(req, res) {
    try {
      let board = await boardModel.open(_getSession(req), req.params.name);
      res.json({status: Const.status.success, message: "board loaded", data: board});
      req.session.log('debug', () => `[controller.board] open board ${req.params.name}`)
    } catch (e) {
      req.session.log('error', () => `[controller.board].open ${req.params.name}, error: ${e.message}`)
      res.json({status: Const.status.error, message: e.message, data:null});
    }
  },

  replace: async function(req, res) {
    try {
      let board = await boardModel.save(_getSession(req), req.params.name);
      res.json({status: Const.status.success, message: "board replaced", data: board});
    } catch (e) {
      res.json({status: Const.status.error, message: e.message, data:null});
    }

  }

}
