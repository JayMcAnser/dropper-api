/**
 * public, without security controller
 */

const boardModel = require('../models/board');
const imageModel = require('../models/image');
const Const = require('../lib/const');
const Logging = require('../lib/logging')
const ApiReturn = require('../lib/api-return');

const _getSession = function(req) {
  return {
    userId: '--public--',
    log: (level, message) => {
      Logging.log(level, message)
    }
  }
}

module.exports = {

  open: async function (req, res) {
    let session = _getSession(req);
    try {
      if (req.params && req.params.name) {
        let board = await boardModel.open( session, req.params.name);
        if (board && board.isPublic) {
          // session.log('info', `[controller.public].open open ${req.params.name}`)
          ApiReturn.result(req,res, board, {type: 'info', message: `[controller.public].open open ${req.params.name}`})
        } else {
          ApiReturn.error(req, res, {message: Const.results.accessDenied}, 403 );
        }
      } else {
        ApiReturn.result(req, res, {message: 'Dropper Curator API is active'}, 'api ping')
      }
    } catch (e) {
      if (e.message === Const.results.boardNotFound) {
        ApiReturn.error(req, res, {message: Const.results.accessDenied}, 403 );
      } else {
        ApiReturn.error(req, res, e)
      }
    }
  },

  openById: async function (req, res) {
    let session = _getSession(req);
    try {
      if (req.params && req.params.id) {
        let board = await boardModel.openById( session, req.params.id);
        if (board && board.isPublic) {
          session.log('info', `[controller.public].open open ${req.params.id}`)
          ApiReturn.result(req, res, board, {type: 'info', message: `[controller.public].open open ${req.params.id}`})
        } else {
          ApiReturn.error(req, res, {message: Const.results.accessDenied}, 403 );
        }
      } else {
        ApiReturn.result(req, res, {message: 'Dropper Curator API is active'}, 'api ping')
      }
    } catch (e) {
      if (e.message === Const.results.boardNotFound) {
        ApiReturn.error(req, res, {message: Const.results.accessDenied}, 403 );
      } else {
        ApiReturn.error(req, res, e)
      }
    }
  },

  /**
   * list all board visible to the public user
   */
  list: async function(req, res) {
    let session = _getSession(req);
    try {
      let data = await boardModel.findAll(session);
      ApiReturn.result(req, res, data, `[controller.public].list found ${data.length} boards`)
    } catch (e) {
      ApiReturn.error(req, res, e)
    }
  },

  /**
   * show an imagge if the user has right to it (public)
   */
  imageGet: async function(req, res) {
    const LOC = '[controller.public].image open';
    try {
      let session = _getSession(req);
      if (req.params && req.params.id && req.params.imageId) {
        let board = await boardModel.openById(session, req.params.id, ['images']);
        if (board && board.isPublic) {
          // so we have the rights to the image
          let filename;
          try {
            filename = await boardModel.imageGet(session, board, req.params.imageId);
          } catch (e) {
            return ApiReturn.error(req, res, e, 404);
          }
          ApiReturn.download(req, res, filename);
          // ApiReturn.result(req, res, board, {type: 'info', message: `${LOC} ${req.params.id}`})
        } else {
          ApiReturn.error(req, res, {message: Const.results.accessDenied}, 403);
        }
      } else {
        ApiReturn.error(req, res, Const.missingParameter, LOC)
      }
    } catch(err) {
      ApiReturn.error(req, res, err)
    }
  }

}
