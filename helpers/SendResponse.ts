import { join } from 'path'

/**
 * @param data JSON data
 * @param statusCode Status code to be returned
 */
function SendJSONResponse(res: import('express').Response, data: Record<string, any>, statusCode: number = 200) {
  return res.status(statusCode).json(data)
}

/**
 * @param path File path, relative to repo root
 * @param statusCode Status code to be returned
 */
function SendFileResponse(res: import('express').Response, path: string, statusCode: number = 200) {
  return res.status(statusCode).sendFile(path, {
    // root is one up from current dir
    root: join(__dirname, '..'),
  })
}

export const JSON = SendJSONResponse
export const File = SendFileResponse
