const Path = require('path')

/**
 * @param {import('express').Response} res
 * @param {object} data JSON data
 * @param {number} [statusCode=200] Status code to be returned
 */
function SendJSONResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json(data)
}

/**
 * @param {import('express').Response} res
 * @param {object} path File path, relative to repo root
 * @param {number} [statusCode=200] Status code to be returned
 */
function SendFileResponse(res, path, statusCode = 200) {
  return res.status(statusCode).sendFile(path, {
    // root is one up from current dir
    root: Path.join(__dirname, '..'),
  })
}

module.exports = {
  JSON: SendJSONResponse,
  File: SendFileResponse,
}
