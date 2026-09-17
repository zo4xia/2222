import { handleCheckRevertRequest } from '../../server/checkAgentHandler.js'

export default function handler(req, res) {
  return handleCheckRevertRequest(req, res)
}
