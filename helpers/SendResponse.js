/**
 * @param {import('express').Response} res
 * @param {object} data JSON data
 * @param {number} [statusCode=200] Status code to be returned
 */
function SendJSONResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({ apiVersion: 1, ...data })
}

module.exports = {
  JSON: SendJSONResponse,
}
