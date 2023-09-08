
// https://www.mongodb.com/docs/drivers/node/current/usage-examples/changeStream/
// single node: https://onecompiler.com/posts/3vchuyxuh/enabling-replica-set-in-mongodb-with-just-one-node

const { MongoClient } = require("mongodb")
// Replace the uri string with your MongoDB deployment's connection string.
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const simulateAsyncPause = (t = 1000) =>
  new Promise(resolve => {
    setTimeout(() => resolve(), t);
  });
let changeStream;


const testBulk = async(haikus) => {
  let id = await haikus.insertOne({
    title: "rec 2",
    name: 'not changed',
    content: "No bytes, no problem. Just insert a document, in MongoDB",
  });
  id = await haikus.insertOne({
    title: "rec 3",
    name: 'not changed',
    content: "No bytes, no problem. Just insert a document, in MongoDB",
  });
  await simulateAsyncPause()
  console.log('-------------------------------------start')
  await haikus.updateMany({

  }, {
    "$set": {  name: 'new value'}
  })
  await simulateAsyncPause()
}
async function run() {
  try {
    const database = client.db("insertDB");
    const haikus = database.collection("haikus");
    // open a Change Stream on the "haikus" collection
    changeStream = client.watch();
    // set up a listener when change events are emitted
    changeStream.on("change", next => {
      // process any change event
      console.log("received a change to the collection: \t", next);
    });
    await simulateAsyncPause();
    let id = await haikus.insertOne({
      title: "Record of a Shriveled Datum",
      name: 'not changed',
      content: "No bytes, no problem. Just insert a document, in MongoDB",
    });
    await simulateAsyncPause();
    await haikus.updateOne({
      _id: id.insertedId
    }, {
      "$set": {  title: 'testing'}
    })
    await simulateAsyncPause();

    await testBulk(haikus)

    console.log('listening')
    await simulateAsyncPause(10000)
    await changeStream.close();

    console.log("closed the change stream");
  } finally {
    await client.close();
  }
}
run().catch(console.dir)
