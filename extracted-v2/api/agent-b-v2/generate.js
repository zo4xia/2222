import { handleAgentBV2Request } from '../../server/agentBV2Handler.js'

export default function handler(req, res) {
  return handleAgentBV2Request(req, res)
}
