/**
 * Board model.
 *
 * These are currently stored in files. All board are global (not user specific
 *
 * version 1.0
 *
 */
const Config = require('config');
const Fs = require('fs');
const Path = require('path');
const Helper = require('../lib/helper');
const { v4 : uuidv4} = require('uuid');
const JsonFile = require('jsonfile');
const Const = require('../lib/const')
const Logging = require('../lib/logging');

const historyActions = {
  imageAdd: 'image.add',
  imageDelete: 'image.dlete',
  imageUpdate: 'image.update'
}

module.exports = {
  get rootDir() {
    return Helper.getFullPath('', {rootKey:'Path.dataRoot'})
  },

  _validateSession: function(session) {
    if (!session.userId) {
      throw new Error(`[board] ${Const.results.missingSession}`);
    }
  },

  _loadBoards: function(session, all= true) {
    let dirName = Helper.getFullPath('', {  rootKey: 'Path.dataRoot'})
    let boardIds = Fs.readdirSync(dirName);
    boardIds = boardIds.filter( (dirent) => {
      return Fs.statSync(Path.join(dirName, dirent)).isDirectory()
    })

    let boards = []
    for (let index = 0; index < boardIds.length; index++) {
      try {
        let board = JsonFile.readFileSync(Path.join(dirName, boardIds[index], Config.get('Board.indexFilename')));
        if (board.ownerId === session.userId ||
          board.isPublic ||
          board.users.findIndex( (u) => u.userId === session.userId) >= 0) {
          boards.push({
            id: boardIds[index],
            name: board.name,
            title: board.title,
            isPublic: board.isPublic,
            description: board.description,
          })
        }
      } catch (e) {
        Logging.log('warn', `opening baord ${boardIds[index]} returns an error: ${e.message}`)
      }
    }
    return boards;
  },

  _historyAdd(session, board, action, message = false) {
    if (!board.history) { board.history = []}
    let hist = {
      date: Date.now(),
      userId: session.userId,
      action: action
    }
    if (message) {
      hist.message = message
    }
    board.history.push(hist)
  },
  create: async function(session, board) {
    this._validateSession(session);

    if (board.name === undefined) {1
      throw new Error(`[board] ${Const.results.boardNameRequired}`);
    }
    // check the name in unique
    let b = await this.findOne(session, { name: board.name})
    if (b) {
      throw new Error(`[board] ${Const.results.boardExists}`);
    }

    let boardStore = {
      id: uuidv4(),
      name: board.name,
      title: board.title ? board.title: board.name,
      ownerId: session.userId,
      isPublic: false,
      users: [],
      description: '',
      history: [{userId: session.userId, date: Date.now(), type: 'created'}],
      columns: board.columns ? board.columns: []
    }

    let filename = Helper.getFullPath(Config.get('Board.indexFilename'),{
      rootKey: 'Path.dataRoot',
      subDirectory: boardStore.id,
      makePath: true, returnPaths: true})
    let result = await JsonFile.writeFile(filename, boardStore);
    //ToDo: we should register our board to in the database
    Fs.mkdirSync(Path.join(Path.dirname(filename), 'media'))
    return boardStore.id
  },

  async findOne(session, what) {
    this._validateSession(session);
    let boards = this._loadBoards(session)
    return boards.find( (u) => {
      for (let key in what) {
        if (!what.hasOwnProperty(key)) { continue }
        if (what[key] === undefined || u[key] != what[key]) {
          return false
        }
      }
      return true;
    })
  },

  async findById(session, id) {
    this._validateSession(session);
    let filename = Helper.getFullPath(Config.get('Board.indexFilename'), { rootKey: 'Path.dataRoot', subDirectory: id, alwaysReturnPath: true})
    if (Fs.existsSync(filename)) {
      return JsonFile.readFileSync(filename)
    }
    throw new Error(Const.results.boardNotFound);
  },
  /**
   * retrieve all boards allowed
   *
   * @param session
   * @param filter  {name | title | isPublic}
   * @returns {Promise<[]>}
   */
  async findAll(session, filter = false) {
    this._validateSession(session);

    let boards = this._loadBoards(session)
    if (filter) {
      return boards.find( (u) => {
        for (let key in whfilterat) {
          if (!filter.hasOwnProperty(key)) { continue }
          if (!filter[key] === undefined || u[key] != filter[key]) {
            return false
          }
        }
        return true;
      })
    }
    return boards;
  },

  /**
   * one a board
   *
   * @param session
   * @param name Object | string Object is the board self (inc id and name). string: id
   * @returns {Promise<*>}
   * @private
   */
  async _read(session, name) {
    let board;
    if (typeof name === 'string') {
      board = await this.findById(session, name);
    } else {
      board = await this.findOne(session,{name:  name.name});
    }
    if (board) {
      let filename = Helper.getFullPath(Config.get('Board.indexFilename'), {
        rootKey: 'Path.dataRoot',
        subDirectory: board.id
      })
      if (Fs.existsSync(filename)) {
        return JsonFile.readFile(filename);
      }
    }
    throw new Error(Const.results.boardNotFound);
  },
  /**
   * lowlevel writing a board
   *
   * @param session
   * @param board
   * @returns {Promise<*>}
   * @private
   */
  async _write(session, board) {
    let filename = Helper.getFullPath(Config.get('Board.indexFilename'), {
      rootKey: 'Path.dataRoot',
      subDirectory: board.id
    });
    if (Fs.existsSync(filename)) {
      return JsonFile.writeFile(filename, board);
    }
    throw new Error(Const.results.boardNotFound)
  },

  _returnData(raw, fields) {
    let result = {
      id: raw.id,
      title: raw.title,
      name: raw.name,
      isPublic: raw.isPublic,
      description: raw.description
    }
    for (let index = 0; index < fields.length; index++) {
      result[fields[index]] = raw[fields[index]];
    }
    return result;
  },


  async open(session, name, fields = ['description', 'columns']) {
    this._validateSession(session);
    let raw = await this._read(session, {name: name});
    return this._returnData(raw, fields)
  },

  async openById(session, id, fields = ['description', 'columns']) {
    this._validateSession(session);
    let raw = await this._read(session, id);
    return this._returnData(raw, fields)
  },
  /**
   * saving a board is only saving the group information
   * @param session
   * @param board Object
   * @returns {Promise<void>}
   */
  async save(session, board, fields = ['columns']) {
    this._validateSession(session);
    let boardDef = await this._read(session, board.id)
    for (let index = 0; index < fields.length; index++) {
      boardDef[fields[index]] = board[fields[index]];
    }
    return this._write(session, boardDef, { spaces: 2, EOL: '\r\n' })
  },

  /**
   * set the view right for a board
   * @param session
   * @param board
   * @param isPublic
   * @returns {Promise<void>}
   */
  async setPublic(session, board, isPublic) {
    this._validateSession(session);
    let boardDef = await this._read(session, board)
    boardDef.isPublic = !!isPublic
    return this._write(session, boardDef, { spaces: 2, EOL: '\r\n' })
  },

  async delete(session, boardName) {
    this._validateSession(session);
    let board = await this.findOne(session, {name: boardName});
    if (board) {
      const Rimraf = require('rimraf');
      Rimraf.sync(Helper.getFullPath(board.id,{rootKey: 'Path.dataRoot'}));
    }
    return true;
  },

  _getImageRec(image) {
    return {
      id: typeof image === 'object' && image.id ? image.id : uuidv4(),
      filename: typeof image === 'object' ? image.filename : image,
      name: typeof image === 'object' ? image.name : Path.basename(image)
    }
  },

  /**
   *  add add a new image. Return
   * @param {Session} session
   * @param {Object} board
   * @param {} image
   * @return String id of image
   */
  async imageAdd(session, board, image) {
    let imageObj = this._getImageRec(image);
    let filename = Helper.getFullPath(imageObj.id, {
      rootKey: 'Path.dataRoot',
      extension: Path.extname(imageObj.filename),
      subDirectory: Path.join(board.id, 'media'),
      alwaysReturnPath: true,
      makePath: true
    })
    Fs.renameSync(imageObj.filename, filename )
    imageObj.filename = Path.basename((imageObj.filename)); // strip the path, only the name is important
    if (!board.images) {
      board.images = [imageObj];
    } else {
      board.images.push(imageObj)
    }
    this._historyAdd(session, board, historyActions.imageAdd, imageObj.id)
    return this.save(session, board, ['history', 'images']).then( () => {
      return imageObj.id
    });
  },
  /**
   *
   * @param {Session} session
   * @param {Board} board Full board or partial board
   * @param {String} imageId
   * @returns {String} the name of the file
   */
  async imageGet(session, board, imageId) {
    let boardDef = board;
    if (!boardDef.images) {
      boardDef = await this.openById(session, board.id, ['images'])
    }
    let image = boardDef.images.find( (img) => img.id === imageId);
    if (image) {
      let filename = Helper.getFullPath(image.id, {
        rootKey: 'Path.dataRoot',
        extension: Path.extname(image.filename),
        subDirectory: Path.join(boardDef.id, 'media')
      })
      if (filename && Fs.existsSync(filename)) {
        return filename
      }
    }
    let err = new Error(Const.results.imageNotFound);
    err.statusCode = 404;
    throw err;
  },
  /**
   * changes the image to an different
   * @param {} session
   * @param {*} board
   * @param {*} image
   */
  async imagePut(session, board, image) {
    throw new Error(Const.notImplemented)
  },

}
