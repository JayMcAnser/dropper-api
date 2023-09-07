/**
 * role base access rights\
 *
 * V1.0.0 @jay 2023-03-27
 *
 */
const Mongoose = require("../lib/db-mongo");
const Schema = Mongoose.Schema;
const UserModel = require('../model/user-model')

const UserGroupSchema =  new Schema({
  name: String,
  key: String,
  description: String,
  apiAccess: [  // used by the api
    String
  ],
  urlAccess: [     // used by tghe front end
    String
  ]
})

/**
 * reset the rights for all user to the definition set in the groups
 * Should be called every time a user or a group is changed
 * @returns {Promise<void>}
 */
UserGroupSchema.statics.setRights = async function() {
  let users = await UserModel.find({})
  let UserGroup = this.model('UserGroup')
  for (let index = 0; index < users.length; index++) {
    let user = users[index];
    user.apiAccess = [];
    user.urlAccess = [];
    for (let groupIndex = 0; groupIndex < user.groups.length; groupIndex++) {
      let grp = await UserGroup.findOne({key: user.groups[groupIndex]})
      if (!grp) {
        console.log(`missing group ${user.groups[groupIndex]} for user ${user.email}`)
      } else {
        for (let urlIndex = 0; urlIndex < grp.apiAccess.length; urlIndex++) {
          if (user.apiAccess.indexOf(grp.apiAccess[urlIndex]) < 0) {
            user.apiAccess.push(grp.apiAccess[urlIndex])
          }
        }
        for (let urlIndex = 0; urlIndex < grp.urlAccess.length; urlIndex++) {
          if (user.urlAccess.indexOf(grp.urlAccess[urlIndex]) < 0) {
            user.urlAccess.push(grp.urlAccess[urlIndex])
          }
        }
      }
    }
    await user.save();
  }
}
// /**
//  * examples
//  * UserGroup: name: 'Royalties', key: 'royalties', apiAccess: ['/royalty/list', '/royalties/erros*']
//  * Usergroup: name: 'Statistics', key: 'statistics', apiAccess:['/statistics/*'], urls: ['/statistics/mediakunst/*']
//  * Usergroup: name: 'root', key: 'root', apiAccess: ['**/*'], urls:['**/*']
//  * User: name:'Jay', groups:['royalties', 'statistics']
//  * User: name: 'admin', groups['root']
//  */


module.exports = Mongoose.Model('UserGroup', UserGroupSchema);
