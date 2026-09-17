import { handleCheckApplyRequest } from '../../server/checkAgentHandler.js'

export default function handler(req, res) {
  return handleCheckApplyRequest(req, res)
}
