const ApiReturn = require('../lib/api-return');

const _reqData = (req) => {
  return {
    title: req.body.title
  }
}

const _cardFields = (card) => {
  return {
    id: card._id ? card._id.toString() : '',
    title: card.title,
    comment: card.comment,
    fields: card.fields,
  }
}

module.exports = {
  info: async function(req, res) {
    return ApiReturn.result(req, res, {status: 'alive'}, ApiReturn.STATUSCODE_OK)
  },

  /**
   * create a new card in the current project
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  create: async function(req, res) {
    try {
      let card = await req.session.cardAdd(_reqData(req))

      if (card.id) {
        return ApiReturn.result(req, res, _cardFields(card, ApiReturn.STATUSCODE_OK))
      } else {
        return ApiReturn.error(req, res, 'could not create card', ApiReturn.STATUSCODE_BAD_REQUEST)
      }
    } catch (e) {
      return ApiReturn.error(req, res, e, ApiReturn.STATUSCODE_INTERNAL_ERROR)
    }
  },

  /**
   * list all cards in the project (query.all=1) or find one (query.id)
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  list: async function(req, res) {
    try {
      if (req.query.all) {
        let cards = (await req.session.model.Card.find({})).map((c) => {
          return _cardFields(c)
        })
        return ApiReturn.result(req, res, cards, ApiReturn.STATUSCODE_OK)
      } else if (req.query.id) {
        let card = _cardFields(await req.session.model.Card.findById(req.query.id))
        return ApiReturn.result(req, res, card, ApiReturn.STATUSCODE_OK)
      } else {
        return ApiReturn.result(req, res, 'no query', ApiReturn.STATUSCODE_BAD_REQUEST)
      }
    } catch (e){
      return ApiReturn.error(req, res, e, ApiReturn.STATUSCODE_INTERNAL_ERROR)
    }
  }
}
