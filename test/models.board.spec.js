
const Init = require('./init-test');
const chai = require('chai');
const assert = chai.assert;

const Fs = require('fs');
const Path = require('path');
const Board = require('../models/board');
const Const = require('../lib/const')

describe('models.board', () => {

  const TEST_NAME = 'test-board';
  let session = {};
  let boardId;
  let dataDir = Path.join(__dirname, 'data');

  before( async () => {
    try {
      session.userId = await Init.AuthUserId;
      await Board.delete(session, TEST_NAME);
    } catch(e){
      console.error(`model.board: ${e.message}`)
    }
  })


  it('create', async() =>{
    boardId = await  Board.create(session, {name: TEST_NAME});
    assert.isTrue(boardId > '0');
  });
  it ('create - duplicate', async() => {
    try {
      boardId = await Board.create(session, {name: TEST_NAME});
      assert.fail('board name is not unique')
    } catch(e) {
      assert.equal(e.message, `[board] ${Const.results.boardExists}`)
    }
  })

  it('findOne', async() => {
    let board = await Board.findOne(session, {name: TEST_NAME});
    assert.equal(board.id, boardId)
  })

  it('findAll', async() => {
    let boards = await Board.findAll(session);
    assert.isTrue(boards.length >= 1, 'found boards');
    assert.isTrue(boards.findIndex( (x) => x.name === TEST_NAME) >= 0, 'has test filename')
  });

  it('open', async() => {
    let board = await Board.open(session, TEST_NAME);
    assert.isDefined(board.id, 'found the board');
  });

  it('save', async() => {
    let board = await Board.open(session, TEST_NAME);
    board.columns = [{id: 1}]
    await Board.save(session, board);
    // check we wrote it to disk
    board = await Board.open(session, TEST_NAME);
    assert.isDefined(board.columns, 'has something');
    assert.equal(board.columns[0].id, 1)
  });

  it('make public', async () => {
    let board = await Board.open(session, TEST_NAME);
    assert.isFalse(board.isPublic);
    await Board.setPublic(session, board, true);
    board = await Board.open(session, TEST_NAME);
    assert.isTrue(board.isPublic)
  });

  it('image - add - by filename', async () => {
    let board = await Board.open(session, TEST_NAME);
    Fs.writeFileSync( Path.join(dataDir, 'image.png'), 'dummy date');
    let imageId = await Board.imageAdd(session, board, Path.join(dataDir, 'image.png'));
    assert.isDefined(imageId, 'return of the image id');
    let filename = Path.join(Board.rootDir, board.id, 'media', imageId + '.png')
    assert.isTrue(Fs.existsSync(filename), filename);

    let imageFilename = await Board.imageGet(session, board, imageId);
    assert.isTrue(Fs.existsSync(imageFilename))
  });

  it('image - add - by definition', async () => {
    let board = await Board.open(session, TEST_NAME);
    Fs.writeFileSync( Path.join(dataDir, 'image2.png'), 'dummy date');

    let imageId = await Board.imageAdd(session, board, {filename: Path.join(dataDir, 'image2.png'), name: 'testing'});
    assert.isDefined(imageId, 'return of the image id');
    let filename = Path.join(Board.rootDir, board.id, 'media', imageId + '.png')
    assert.isTrue(Fs.existsSync(filename), filename);

    let imageFilename = await Board.imageGet(session, board, imageId);
    assert.isTrue(Fs.existsSync(imageFilename))
  });

});
