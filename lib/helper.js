/**
 * General purpose routines
 *
 * Version 2.0 => multipath
 * version 2.1 => set rootPath
 */
const Path = require('path');
const Config = require('config');
const fs = require('fs');
const _ = require('lodash');

let RelativePath = '../..';
const setRelativePath = function(path) {
  RelativePath = path;
}

/**
 * compares a value to an key in an object
 * @param object Object the object to check
 * @param key String | Array  'key', 'obj.key', [key], [obj, key]
 * @param value String the value to check or undefined to check for existance
 * @return Boolean
 * @private
 */
module.exports.compareKeyInObject = (object, key, value = undefined)  => {
  if (!Array.isArray(key)) {
    key = key.split('.')
  }
  let result = object;
  for (let index = 0; index < key.length; index++) {
    // somehow the hasOwnProperty is not on the object .....
    if ( result.hasOwnProperty && result.hasOwnProperty(key[index]) || result[key[index]]) {
      result = result[key[index]];
      if (index === key.length - 1) {
        return value === undefined || result === value;
      }
    } else {
      break;
    }
  }
  return false;
}
/**
 * retrieve the value of an nested object by the key
 * examples on { data: {key1: { keyExtra: 'theValue'}}}
 *   data.key1.keyExtra
 *
 * @param object Object the object to check
 * @param keyString String | Array  'key', 'obj.key', [key], [obj, key]
 * @return value
 */

module.exports.getKeyInObject =  (object, keyString, defaultValue = undefined)  => {
  if (typeof object !== 'object') {
    return defaultValue;
  }
  if (!Array.isArray(keyString)) {
    keyString = keyString.split('.')
  }
  let result = object;
  for (let index = 0; index < keyString.length; index++) {
    let key = keyString[index];
    if (result.hasOwnProperty(key)) {
      result = result[key];
    } else {
      let bracketStart = key.indexOf('[');
      let bracketEnd = key.indexOf(']')
      if (bracketStart < 0 || bracketEnd < 0) {
        break;
      } else {
        let keyName = key.substring(0, bracketStart)
        if (result.hasOwnProperty(keyName)) {
          result = result[keyName];
          let index = key.substring(bracketStart + 1, bracketEnd).trim();
          if (result.hasOwnProperty(index)) {
            result = result[index]
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
    if (index === keyString.length - 1) {
      return result;
    }
  }
  return defaultValue
}

module.exports.configValue = (path, defaultValue) => {
  if (Config.has(path)) {
    return Config.get(path)
  } else {
    return defaultValue
  }
}

/**
 * generate the full path of a filename, relative to the config
 * @param filename String Array or Object the filename to store
 * @param options Object
 *    rootKey String the Config root key where to store
 *    rootPath String if rootKey is not there the path to use
 *    paths Array of String the array of paths to check. Replaces rootKey if not available
 *    relativeTo String root is relative to the current directory. This is the path (mostly '../..')
 *    subDirectory String the directory to store the info in
 *    makePath Boolean force the path to be created
 *    extension String the required extension (if not there) including .
 *    noExistsCheck: false if true the existence of the file isn't checked
 *    returnPaths: Boolean if true and paths or config[rootKey] = array it will return all paths,
 *    noWarn: false if true no warning is displayed if file does not exist
 *    alwaysReturnPath: false return a path even if the file does not exits
 */

const getFullPath = function(filename, options = {}) {
  if (!options.hasOwnProperty('noWarn')) { options.noWarn = false}
  if (!options.hasOwnProperty('noExistsCheck')) { options.noExistsCheck = false }
  if (!options.hasOwnProperty('alwaysReturnPath')) { options.alwaysReturnPath = false}
  if (Array.isArray(filename)) {
    // if we want multiple files all are send through this moduule
    let result = [];
    for (let index = 0; index < filename.length; index++) {
      result.push(getFullPath(filename[index], options))
    }
    return result;
  } else if (typeof filename === 'object') {
    let result = {}
    for (let fieldname in filename) {
      if (!filename.hasOwnProperty(fieldname)) { continue }
      result[fieldname] = getFullPath(filename[fieldname], options);
    }
    return result;
  } else {
    if (filename && filename.length && filename[0] === '/') {
      return filename;
    }
    let path = [];
    let relative = options.relativeTo !== undefined ? options.relativeTo : RelativePath;
    if (options.rootKey || options.paths) {
      if (options.rootKey !== undefined && Config.has(options.rootKey)) {
        path = Config.get(options.rootKey);
      }
      if (options.paths) {
        path = options.paths.concat(path); // place the local path first
      }
      // v2.24 => allow for multiple pathes
      if (Array.isArray(path)) {
        let pathList = [];
        let primaryPath = false;
        for (let pathIndex = 0; pathIndex < path.length; pathIndex++) {
          let foundPath = getFullPath(filename, {
            rootPath: path[pathIndex],
            subDirectory: options.subDirectory,
            extension: options.extension,
            makePath: false,
            relativeTo: path[pathIndex][0] === '/' ? '' : RelativePath, // '../..',
            noExistsCheck: true
          })
          if (fs.existsSync(foundPath)) {
            if (options.returnPaths) {
              pathList.push(foundPath)
            } else {
              return foundPath; // find the first path
            }
          } else if (!primaryPath) {
            primaryPath = foundPath;
          }
        }
        if (pathList.length) { // we found multiple pathes
          return pathList;
        }
        if (options.alwaysReturnPath) {
          if (options.makePath) {
            fs.mkdirSync(Path.dirname(primaryPath), {recursive: true})
          }
          return primaryPath        }
        if (!options.returnPaths && !options.noWarn) {
          const Logging = require('./logging');
          if (Logging.warn) { // v1
            Logging.warn(`[helper] the file ${filename}${options.extension ? options.extension : ''} does not exist`);
          } else {
            Logging.log('warn', `[helper] the file ${filename}${options.extension ? options.extension : ''} does not exist`)
          }
        }
        return false;
      }
      if (path.length && path[0] !== '/') {
        path = Path.join(__dirname, relative, path);
      }
    } else if (options.rootPath) {
      if (options.rootPath.length && options.rootPath[0] !== '/') {
        path = Path.join(__dirname, relative, options.rootPath);
      } else {
        path = Path.join(options.rootPath, relative);
      }
    } else {
      path = Path.join(__dirname, relative);
    }
    if (options.subDirectory) {
      path = Path.join(path, options.subDirectory);
    }

    if (filename && options.extension && Path.extname(filename) !== options.extension) {
      filename += options.extension;
    }
    // the file name can include a path. So we first must concatenate the info
    let result = path;
    let dirName;
    if (filename) {
      result =  Path.join(path, filename);
      dirName = Path.dirname(result);
    } else {
      dirName = result;
    }

    if (options.noExistsCheck === false) {
      if (!fs.existsSync(dirName)) {
        if (options.makePath) {
          fs.mkdirSync(dirName, {recursive: true})
        } else if (!options.noWarn) {
          // should be placed here because the Logging is not initialized because it uses the getFullPath
          const Logging = require('./logging');
          Logging.warn(`[helper] the path ${dirName} does not exist`)
        }
      }
    }
    return result;
  }
}

  /**
  *
  * @param result Object the patchable object. the object is changed
* @param values the Object holding the values
* @param path the path working on
* @return Object the result object
*/
const patchConfig = (result, values, path = '') => {
  const Logger = require('./logging');
  const Logging = require('./logging');

  if (typeof result !== 'object') {
    return ''
  }
  for (let key in values) {
    if (!values.hasOwnProperty(key)) { continue }
    if (result.hasOwnProperty(key)) {
      if (Array.isArray(result[key])) {
        Logger.debug(`[patchConfig] replace element ${path}/${key} wtih ${JSON.stringify(values[key])}`)
        result[key] = values[key];
      } else if (typeof result[key] === 'object') {
        patchConfig(result[key], values[key], `${path}/${key}`)
      } else if (values[key] === undefined) {
        Logger.debug(`[patchConfig] removed ${path}/${key}`)
        delete result[key];
      } else {
        Logger.debug(`[patchConfig] set ${path}/${key} to ${values[key]}`)
        result[key] = values[key];
      }
    } else if (key[0] === '$') {
      Logging.debug(`[importer].patch add element to ${path}/${key.substr(1)}: ${JSON.stringify(values[key])}`)
      if (Array.isArray(values[key])) {
        result[key.substr(1)] = result[key.substr(1)].concat(values[key])
      } else {
        result[key.substr(1)].push(values[key])
      }
    } else {
      Logger.debug(`[patchConfig] added ${path}/${key} to ${JSON.stringify(values[key])}`)
      result[key] = values[key]
    }
  }
  return result;
}

const removeComments = (values) => {
  for (let key in values) {
    if (key.substr(0,4) === '<!--') {
      delete values[key]
      continue
    }
    if (typeof values[key] === 'object') {
      values[key] = removeComments(values[key])
    }
  }
  return values;
}

module.exports.getFullPath = getFullPath;
module.exports.patchConfig = patchConfig;
module.exports.removeComments = removeComments;
module.exports.setRelativePath = setRelativePath;
