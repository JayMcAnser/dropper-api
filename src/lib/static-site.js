/**
 * server the static information
 */

const Config = require('config')
const Express = require('express');
const Helper = require('./helper');
const Fs = require('fs');
const Path = require('path');
const Logging = require('./logging');
const Url = require('url');
const ApiReturn = require('./api-return');
// const Mime = require('mime/lite')

class StaticSite {
  constructor(app) {
    this._app = app;
    this._siteRoot = Helper.getFullPath('', { rootKey: 'Path.siteRoot', mustExist: true})
    if (!Fs.existsSync(this._siteRoot)) {
      Logging.log('error', `site root ${this._siteRoot} does not exist`);
      throw new Error(`site root does not exist`)
    }
    if (!Fs.existsSync(Path.join(this._siteRoot, 'index.html'))) {
      Logging.log('error', `missing index.html in ${this._siteRoot}`);
      throw new Error(`missing index.html`)
    }
    let vm = this;
    // this._app.get('/', function( req, res) {
    //   res.sendFile(Path.join(vm._siteRoot, 'index.html'))
    // })
    // this._app.use(Express.static(this._siteRoot));
    this._app.use(function(req, res, next) {
      try {
        let url = Url.parse(req.url);
        let pathName = url.pathname === '/' || !url.pathname ? 'index.html' : url.pathname
        let filename = Path.join(vm._siteRoot, pathName);
        Logging.log('debug', `request ${filename}`)
        if (Fs.existsSync(filename)) {
        // TODO PACKAGE NOT FOUND  let mimeType = Mime.getType(Path.extname(filename));
          if (mimeType) {
            res.set('Content-Type', mimeType);
          }

          res.sendFile(filename)
        } else if (pathName === '/version') {
          ApiReturn.result(req, res, `Dropper version ${require('../../package.json').version}`)
        } else {
          // if not found, we return the index
          res.sendFile(Path.join(vm._siteRoot, 'index.html'));
          // let err = new Error(Const.results.urlNotFound);
          // err.status = 404;
          // next(err);
        }
      } catch (e) {
        ApiReturn.error(req, res, e)
      }
    });
  }

}

module.exports = StaticSite

