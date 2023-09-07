/**
 *
 */

const Mongoose = require('mongoose');


module.exports.QuerySession = function() {
  Mongoose.Query.prototype.session = function(session, aCallback) {
    //console.log(this);
    // let query = this;
    // return query.run(aError, aDocs) {
    //   if (aError) {
    //
    //   }
    // }
    if (aCallback) {
      return aCallback(null);
    }
    return this;
  }
}

module.exports.replaceAll = (str, oldVal, newVal) => {
  return str.split(oldVal).join(newVal)
}

module.exports.isNumeric = (str) => {
  if (typeof str != "string") return false // we only process strings!
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

module.exports.splitDateAdd = (str) => {
  return {
    num: str.substring(0, str.length - 1),
    key: str.substring(str.length - 1)
  }
}

module.exports.validateEmail = (email) => {
  return (email || '').match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};
