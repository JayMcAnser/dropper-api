  let opt = process.argv;
  if (opt.indexOf('-d') >= 0 || !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'develop';
  }
  process.env.NODE_CONFIG_DIR = __dirname + '/../config/';


  const express = require('express');
  const { createServer } = require('http')
  const { Server } = require('socket.io')
  const cors = require('cors');
  const Logging = require('./lib/logging');
  const bodyParser = require('body-parser');
  const Config = require('config');
  const ApiReturn = require('./lib/api-return');
  // const StaticSite = require('./lib/static-site');
  // const Path = require('path');


  // set our logging to the root of the config
  const { setRootPath } = require('./lib/helper');

  /**
   * register our basic factory
   */
  // const Factory = require('./lib/factory');
  // if (!Factory.has('user')) {
  //   Factory.register('user', () => {
  //     return require('./model/user');
  //   })
  // }
  // if (!Factory.has('session')) {
  //   Factory.register('session', () => {
  //     return require('./lib/session')
  //   })
  // }

  // setRootPath(Path.join(__dirname, '..', Config.get('Path.configRoot')))
  const app = express();
  const httpServer = createServer(app)
  const io = new Server((httpServer))

  app.use(cors())
  Logging.init(app)

  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json())

  const AuthController = require('./controllers/auth');
  const Helper = require("./lib/helper");
  const Path = require("path");
  app.use('/api/auth', require('./routes/auth'));
  // app.use('/api/user',  AuthController.validate,  require('./routes/user'));
  app.use('/api/version', function(req, res) {
    ApiReturn.result(req, res, `API version ${require('../package.json').version}`)
  })
  app.use('/api/test', require('./routes/test'))
  app.use('/api/card', AuthController.validate, require('./routes/card'))
  app.use('/api/project', AuthController.validate, require('./routes/project'))

  app.get('/', (req, res) => {
    res.sendFile(Path.join(__dirname, '../public_html/index.html'))
  })

  // handle errors
  app.use(function(err, req, res, next) {
    ApiReturn.error(req, res, err, '[global.error]', err.status)
  });

  const CardHandler = require('./handlers/card-handler')
  let cards;
  io.on('connection', (socket) => {
    cards = new CardHandler(io, socket)
    cards.init()
    // console.log('a user connected');
    // socket.on('disconnect', () => {
    //   console.log('user disconnected');
    // });
    // socket.on('message', (msg) => {
    //   console.log('message:', msg)
    //   io.emit('chat message', msg);
    // });
  });

  try {
    let listener = httpServer.listen(Config.get('Server.port'),
      function () {
        console.log(`Server (http://localhost:${Config.get('Server.port')}) is active as ${process.env.NODE_ENV}. (data: ${Helper.getFullPath('', {rootKey: 'Path.dataRoot'})})`)
      }
    );
  } catch(e) {
    console.error(`Error in startup: ${e.message}`)
  }
  // httpServer.listen

