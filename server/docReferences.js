import { readFileSync } from 'node:fs'

export const AGENT_A_KNOWLEDGE_BASE = JSON.parse(
  readFileSync(new URL('../doc/knowledge-a.compact.json', import.meta.url), 'utf8'),
)
