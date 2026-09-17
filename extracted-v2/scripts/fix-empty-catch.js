import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function walk(dir, exts) {
  const results = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...walk(full, exts))
    } else if (exts.some(ext => name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

const files = [
  ...walk('server', ['.js']),
  ...walk('src', ['.js', '.vue']),
]

let totalFixed = 0

for (const file of files) {
  let content = readFileSync(file, 'utf-8')
  const original = content

  // 匹配 catch {} 或 catch (e) {} 或 catch (_){}
  content = content.replace(/catch\s*\(\s*(_\w*|\w+)?\s*\)\s*\{\s*\}/g, (_match, varName) => {
    const v = varName && !varName.startsWith('_') ? varName : 'err'
    return `catch (${v}) { console.warn('[empty-catch:${file}]', ${v}?.message || ${v}) }`
  })
  // 匹配 catch {
  content = content.replace(/catch\s*\{\s*\}/g, 'catch (err) { console.warn(\'[empty-catch:' + file + ']\', err?.message || err) }')

  if (content !== original) {
    writeFileSync(file, content, 'utf-8')
    totalFixed++
    console.log('✅ 修复:', file)
  }
}

console.log(`\n共修复 ${totalFixed} 个文件`)
