import { handleCheckAgentRequest } from '../../server/checkAgentHandler.js'

export default function handler(req, res) {
  return handleCheckAgentRequest(req, res)
}
