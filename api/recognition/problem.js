import { handleRecognitionRequest } from '../../server/recognitionHandler.js'
import { AGENT_A_KNOWLEDGE_BASE } from '../../server/docReferences.js'

const knowledge = {
  knowledgeBase: AGENT_A_KNOWLEDGE_BASE,
}

export default function handler(req, res) {
  return handleRecognitionRequest(req, res, knowledge)
}
