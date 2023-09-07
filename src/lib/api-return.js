/**
 * module handles the result from the request
 *
 * for error reporting: https://jsonapi.org/format/
 */
const Logging = require('./logging');
const {ApiError} = require("./errors");
const ContentType = 'application/vnd.api+json';
const ContentTypeKey = 'content-type';
const Path = require('path')
const Mime = require('mime-types')
const Config = require('config')

const _doLog = (req, info, defaultType) => {
  if (typeof info === 'object') {
    if (req.session && req.session.log) {
      req.session.log(info.type ? info.type : defaultType, info.message ? info.message : info)
    } else {
      Logging.log(info.type ? info.type : defaultType, info.message ? info.message : info)
    }
  } else if (info && typeof info !== 'number') {
    if (req.session && req.session.log) {
      req.session.log(defaultType, info)
    } else {
      Logging.log(defaultType, info)
    }
  }
}

 /**
  *
  * @param {Request} req
  * @param {Response} res
  * @param {Object} data the data to return
  * @param {String|Number} info the information to log or the status if numeric
  * @param {Number} status the status code to return
  */
const result = function(req, res, data, info, status = 200, options = undefined) {
  if (options !== undefined && options.headers) {
    let headers = Object.assign({}, {ContentTypeKey: ContentType}, options.headers )
    for (let type in headers) {
      if (headers.hasOwnProperty && !headers.hasOwnProperty(type)) { continue }
      res.setHeader(type, headers[type])
    }
    // res.setHeader(headers);
  } else {
    res.setHeader(ContentTypeKey, ContentType);
  }
  res.status(typeof info === 'number' ? info : status);
  res.json({ data: data});
   _doLog(req, info, 'info');
}

/**
 * send a stream to the caller
 * @param req
 * @param res
 * @param filename the full path to the file to send
 * @param options
 *    - contentType String the type of content, default application/pdf
 *    - filename String the name for the user, default the filename parameter
 */
const stream = function(req, res, filename, options = {}, status = 200) {
  let fullFilename = options.filename || Path.basename(filename)

  res.setHeader('Content-Type', options.contentType || Mime.lookup(fullFilename))
  res.setHeader('Content-Disposition', `attachment; filename=${fullFilename}`)
  // needed because otherwise the security removes the filename
  res.setHeader('Access-Control-Expose-Headers', '*')
  res.status(status)
  res.sendFile(filename)
}
/**
 *
 * @param {Request}  Request object or session if no request is available
 * @param {Response} res
 * @param {Array of Error} errors
 * @param {String, object} information to log
 * @param {Number} status the status code. If errors has a status, that one is used
 */
const error = function(req, res, errors, info, status = false ) {
  try {
    if (!Array.isArray(errors)) {
      errors = [errors];
    }
    if (res.setHeader) {
      if (!res.headersSent) {
        res.setHeader(ContentTypeKey, ContentType);
      }
    } else {
      res.header = [{ContentTypeKey, ContentType}]
    }
    let statusCode = typeof info === 'number' ? info : status
    if (statusCode === false) {
      if (errors.length && errors[0].status) {
        statusCode = errors[0].status
      } else {
        statusCode = 500
      }
    }
    if (res.status) {
      res.status(statusCode);
    } else {
      res.status = statusCode
    }
    let infoMsg = typeof info === 'number' ? '' : info;
    // create result error
    let jsonErrors = [];

    for (let index = 0; index < errors.length; index++) {
      let err;
      let errMsg
      if (errors[index] instanceof ApiError) {
        errMsg = errors[index].toString();
        err = errors[index].toObject()
      } else {
        errMsg = `${infoMsg ? infoMsg + ' ' : ''}${errors[index].message || errors[index]}`.trim();
        err = {
          status: statusCode,
          title: errors[index].message || errMsg,    // should not contain any data
        };
        if (errors[index].info) {
          err.detail = errors[index].info
        }
        if (errors[index].code) {
          err.code = errors[index].code
        }
        if (errors[index].stack && Config.get('Debug.stackTrace')) {
          err.stack = errors[index].stack.split('\n')
          err.stack.shift();  // the Error: xxxxxx
          err.stack = err.stack.map(e => e.trim().substring(3))
        }
        if (req.params) {
          err.source = {parameters: req.params}
        }
      }
      jsonErrors.push(err);
      // we log the errors individual
      _doLog(req, errMsg, 'error');
    }
    if (res.json) {
      res.json({errors: jsonErrors});
    } else {
      res.json = {errors: jsonErrors}
    }
  } catch (e) {
    console.error(`[api-return.error] fatal error in logger: ${e.message}`)
  }
}
/**
 * Start a download of a file
 * @param {Request} req
 * @param {Result} res
 * @param {*} data
 * @param {*} info
 * @param {*} status
 */
const download = function(req, res, filename) {
  res.download(filename);
  _doLog(req, `download: ${filename}`, 'info');
}

module.exports = {
  result,
  error,
  download,
  stream,
  ContentType,
  STATUSCODE_OK: '200',
  STATUSCODE_UNPROCESSABLE_ENTRY: 422,
  STATUSCODE_LOCKED: 423,
  STATUSCODE_BAD_REQUEST: 400,
  STATUSCODE_UNAUTHERIZED: 401,
  STATUSCODE_FORBIDDEN: 403,

  STATUSCODE_INTERNAL_ERROR: 500,
  STATUSCODE_TO_BE_IMPLEMENTED: 540


}
