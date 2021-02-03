

module.exports = {
  status: {
    success: 'success',
    error: 'error'
  },
  results : {
    dropperActive: 'Dropper API is active',
    accessDenied: 'access denied',
    boardNameRequired: 'a board should have a name',
    boardExists: 'the board already exists',
    boardNotFound: 'board not found',

    noDataDirectory: 'data directory can not be created',
    missingSession: 'session is missing',
    missingParameter: 'parameter is missing',
    fileNotExist: 'file does not exist',
    imageNotFound: 'image not foumd',
    urlNotFound: 'not found',
    notImplemented: 'not implemented',

  },
  result: function(status, message, data) {
    return {status: status, message: message, data: data}
  }

}
