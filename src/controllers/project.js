/**
 * projects owned and handled by the current user
 *
 */

const ApiReturn = require('../lib/api-return');
// const DbMongo = require("../lib/db-mongo");
// const ProjectDef = require("../model/project");

const _projectUsers = (project) => {
  let result = []
  for (let index = 0; index < project.users; index++) {
    result.push({
      userId: project.users[index].userId,
      email: project.users[index].email,
      canComment: project.users[index].canComment,
      canEdit: project.users[index].canEdit,
      isAdmin: project.users[index].isAdmin
    })
  }
}

/**
 * return the field allowed by the interface
 * @param project
 * @return {{comment, id: string, title, users: void}}
 * @private
 */
const _projectFields = (project) => {
  return {
    id: project._id.toString(),
    title: project.title,
    comment: project.comment,
    users: _projectUsers(project),
    owner: project.owner,
    orderKey: project.orderKey,
  }
}

/**
 * merge the session information into the project
 * @param project
 * @param session
 * @return {{comment, id: string, title, users: void} & {__session: *}}
 * @private
 */
const _projectResult = (project, session) => {
  return Object.assign({}, _projectFields(project), {__session: session.userInfo})
}
/**
 * create a new project for the current user
 * @param req
 * @param res
 * @return {Promise<Response>}
 */
const create = async (req, res) => {

  try {
    let projectData = {
      title: req.body.title || 'no title',
    }
    let project = await req.session.projectAdd(projectData)

    if (project._id) {
      // this changes the jwtToken and refreshToken
      return ApiReturn.result(req, res,  _projectResult(project, req.session))
    } else {
      return ApiReturn.error(req, res, 'could not create project', ApiReturn.STATUSCODE_BAD_REQUEST)
    }
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  } finally {
    await req.session.close()
  }
}

const list = async (req, res) => {
  try {
    // let result = await req.session.model.Project.find({'users.userId': req.session.user._id})
    let result = await req.session.model.Project.userProjects(req.session.user._id)
    return ApiReturn.result(req, res, result.map((p) => {
      return _projectFields(p)
    }))
  } catch (e) {
    return ApiReturn.error(req, res, e, e.status || ApiReturn.STATUSCODE_INTERNAL_ERROR)
  }
}


module.exports = {
  create,
  list
}
