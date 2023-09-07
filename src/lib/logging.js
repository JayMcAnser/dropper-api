/**
 * define the basic logging
 * version 2.0
 *
 */
const Config = require('config');
const Fs = require('fs');
const Winston = (Config.has('Modules.winston') && Config.get('Modules.winston') === false) ?
  { format: {}, transports: {Console: () => {}, File: () => {}, createLogger: () => {}} } :
  require('winston');
const Helper = require('./helper');

// src is not in subdirectory but in the main root
Helper.setRelativePath('..');

let _winston = false;
// when to display the log message
let _maxLevel = -1;
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
}

const _formatByName = function(name) {
  const formats = {
    'console.timestamp': Winston.format.combine(
      Winston.format.colorize(),
      Winston.format.timestamp(),
      Winston.format.align(),
      Winston.format.printf( info => `${info.timestamp} ${info.level}: ${info.message.trim()}`)
    ),
    'file.timestamp': Winston.format.combine(
      Winston.format.timestamp(),
      Winston.format.align(),
      Winston.format.printf( info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    'loggly.timestamp': Winston.format.combine(
      Winston.format.timestamp(),
      Winston.format.align(),
      Winston.format.printf( info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
  }
  if (formats[name]) {
    return formats[name]
  }
  return undefined
}

const buildLog = function(logDefinition, app = false) {
  let transports = [];

  for (let index = 0; index < logDefinition.length; index++) {
    let log = logDefinition[index];
    if (['access'].indexOf(log.type) >= 0) {
      if (app) { // only on initialization
        // this type of logging uses morgan
        let options = {};
        if (log.filename) {
          options.stream = Fs.createWriteStream(
            Helper.getFullPath(log.filename, {
              rootKey: 'Path.logRoot',
              noWarn: true,
              alwaysReturnPath: true,
              makePath: true
            }),
            {flags: 'a'}
          )
        }
        if (! (Config.has('Modules.morgan') && Config.get('Modules.morgan') === false)) {
          const Morgan = require('morgan');
          app.use(Morgan(
            log.format ? log.format : 'tiny',
            options));
        }
      }
    } else {
      // use the winston log
      let format = _formatByName(`${log.type}.${log.format}`)
      switch (log.type) {
        case 'console':
          transports.push(new Winston.transports.Console({
            level: log.level === undefined ? 'info' : log.level,
            format: format
          }));
          break;
        case 'file':
          let filename = Helper.getFullPath(log.filename ? log.filename : 'no-name.log',{
            rootKey: 'Path.logRoot',
            noWarn: true,
            alwaysReturnPath: true,
            makePath: true
          })
          transports.push(new Winston.transports.File({
            level: log.level === undefined ? 'info' : log.level,
            filename: filename,
            format
          }));
          break;
        case 'loggly':
          if (log.token === undefined) {
            console.error('[Logging] missing token for loggly');
          } else {
            transports.push(new Loggly({
              level: log.level === undefined ? 'info' : log.level,
              token: log.token,
              subdomain: log.subdomain,
              tags: Array.isArray(log.tags) ? log.tags : [log.tags],
              json: log.isJson === undefined ? true : log.isJson,
              meta: log.meta === undefined ? '' : log.meta,
              format
            }));
          }
          break;
        case 'slack':
          transports.push(new SlackHook({
            webhookUrl: log.url,
            channel: log.channel === undefined ? 'logger' : log.channel,
            username: log.username === undefined ? 'logger' : log.username,
            level: log.level === undefined ? 'info' : log.level,
          }));
          break;
        default:
          console.warn(`unknown log type: ${log.type}`);
      }
      // mark we are going to log to this level

      let tmpLevel = log.level ? log.level: 'info';
      if (!LOG_LEVELS[tmpLevel]) {
        console.error(`unknown logging level: ${tmpLevel}. uses one of ${Object.keys(LOG_LEVELS).join(', ')}`)
      } else if (_maxLevel < LOG_LEVELS[tmpLevel]) {
        _maxLevel = LOG_LEVELS[tmpLevel]
      }
    }
  }

  if (transports.length) {
    return Winston.createLogger({
      transports
    });
  }
  return false; // no logging at all
}
/**
 * initialize the loggers
 *
 * @param app
 */
const init = function(app) {
  if (!Config.has('Logging')) {
    console.error(`the property Logging is undefined`);
  }
  let logger = Config.get('Logging');
  this._winston = buildLog(logger, app);
}

/**
 *
 * @param level on of the winston levels
 * @param message String or function to log. function is only called if level is actually logged
 * @param location the location where the event happened
 *
 * examples:
 *   logger.log('debug','the message');   // procudes 'the message'
 *   logger.log('console', () => { return 'this take a long time'} )) // prints out the message only on console and higher
 */
const _log = function(level, message, location) {
  if (location) {
    write(this._winston, level, `[${location}] ${message}`);
  } else {
    write(this._winston, level, message);
  }
}

const write = function(log, level, message) {
  if (log) {
    if (typeof message === 'function') {
      let mustLogMessage = false;
      if (LOG_LEVELS[level] === undefined) {
        console.error(`unknown log level: ${level}`)
        mustLogMessage = true;
      } else if (LOG_LEVELS[level] <= _maxLevel) {
        mustLogMessage = true;
      }
      if (!mustLogMessage) {
        return;
      }
      message = message();
    }
    log.log(level, message)
  }
}

/**
 *
 * @param evaluate : Boolean
 * @param message String || Object
 * @param options
 *    type: 'log', 'warn', 'error'
 *    exec: function() executed when the test fails
 */
const assert = (evaluate, message, options = {}) => {
  if (!evaluate) {
    console[(options.type ||'log')](message)
    if (options.exec) {
      options.exec()
    }
  }
}

/**
 * log the error and throws it
 * @param error Error or String
 * @param location? string the location where the error was generated
 */
const logAndThrow = function(error, location) {
  let err;
  if (typeof error === 'string') {
    err = new Error(error)
  } else {
    err = error
  }
  _log('error', `${location ? '[' + location + '] ': ''}${err.message}`);
  throw err
}

module.exports.init = init;
module.exports.winston = _winston; // not used any more
module.exports.default = _winston;
module.exports.log = _log;
module.exports.buildLog = buildLog
module.exports.write = write;
module.exports.logThrow = logAndThrow
module.exports.assert = assert
