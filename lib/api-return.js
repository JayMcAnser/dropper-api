/**
 * module handles the result from the request
 */
const Logging = require('./logging');
const ContentType = 'application/vnd.api+json';
const ContentTypeKey = 'content-type';

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
  * @param {String} info the information to log or the status if numeric
  * @param {Number} status the status code to return
  */
const result = function(req, res, data, info, status = 200) {
  res.setHeader(ContentTypeKey, ContentType);
  res.status(typeof info === 'number' ? info : status);
  res.json({ data: data});
  _doLog(req, info, 'info');
}
/**
 * 
 * @param {Request}  Request object or session if no request is available
 * @param {Response} res
 * @param {Array of Error} errors
 * @param {String, object} information to log
 * @param {Number} status the status code
 */
const error = function(req, res, errors, info, status = 500 ) {
  try {
    res.setHeader(ContentTypeKey, ContentType);
    let statusCode = typeof info === 'number' ? info : status
    res.status(statusCode);
    let infoMsg = typeof info === 'number' ? '' : info;
    // create result error
    let jsonErrors = [];
    if (typeof errors !== 'array') {
      errors = [errors];
    }
    for (let index = 0; index < errors.length; index++) {
      let errMsg = `${infoMsg ? infoMsg + ' ' :'' }${errors[index].message}`;
      let err = {
        status: statusCode,
        title: errors[index].message,    // should not contain any data
      };
      if (errors[index].info) {
        err.detail = errors[index].info
      }
      if (errors[index].code) {
        err.code = errors[index].code
      }
      if (req.params) {
        err.source = { parameters: req.params }
      }
      jsonErrors.push(err);
      // we log the errors individual
      _doLog(req, errMsg, 'error');
    }
    res.json({errors: jsonErrors });
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
  ContentType
}
