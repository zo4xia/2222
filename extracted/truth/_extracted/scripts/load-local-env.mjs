import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadLocalEnv({ cwd = process.cwd(), fileName = '.env.local' } = {}) {
  const envPath = join(cwd, fileName);
  if (!existsSync(envPath)) {
    return false;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }

  return true;
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
