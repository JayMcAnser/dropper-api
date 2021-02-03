
const Helper = require('../lib/helper')
const Fs = require('fs');
const Const = require('../lib/const');


module.exports = {
  /**
   * returns the name of the file in the image directory or throws an erro
   * @param {*} session 
   * @param {*} board 
   * @param {*} fileId 
   * @param {*} extension 
   */
  imageName(session, board, fileId, extension = '.png') {
    let name = Helper.getFullPath(fileId, {
      rootKey: 'Path.dataRoot', 
      subDirectory: `${boardId}/images`,
      extension: extension
    })
    if (Fs.existsSync(filename)) {
      let err = new Error(Const.fileNotExist);
      err.statusCode = 404
      throw err;      
    }
    return this.filename;
  }
}