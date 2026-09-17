import { handleCleanupRequest } from '../server/cleanupHandler.js'

export default function handler(req, res) {
  return handleCleanupRequest(req, res)
}
