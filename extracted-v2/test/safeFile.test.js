/**
 * @qh-core LANE=TEST POINT=SAFE_FILE 路径校验单元测试
 */
import { describe, it, expect } from 'vitest'
import { safeFilePath, isValidProjectCode, isValidFilename } from '../server/safeFile.js'
import { resolve } from 'path'

const ROOT = resolve('/tmp/test-root')

describe('safeFilePath', () => {
  it('合法相对路径应返回绝对路径', () => {
    const result = safeFilePath(ROOT, 'handoff/test.json')
    expect(result).toBe(resolve(ROOT, 'handoff/test.json'))
  })

  it('.. 路径应返回 null', () => {
    expect(safeFilePath(ROOT, '../../etc/passwd')).toBeNull()
    expect(safeFilePath(ROOT, '../secret')).toBeNull()
  })

  it('绝对路径应返回 null', () => {
    expect(safeFilePath(ROOT, '/etc/passwd')).toBeNull()
  })

  it('URL 编码的 .. 应返回 null', () => {
    expect(safeFilePath(ROOT, '%2e%2e/secret')).toBeNull()
  })

  it('空字符串应返回 null', () => {
    expect(safeFilePath(ROOT, '')).toBeNull()
    expect(safeFilePath(ROOT, null)).toBeNull()
    expect(safeFilePath(ROOT, undefined)).toBeNull()
  })
})

describe('isValidProjectCode', () => {
  it('合法时间戳格式应通过', () => {
    expect(isValidProjectCode('20260917-120000-123')).toBe(true)
  })

  it('字母数字+连字符应通过', () => {
    expect(isValidProjectCode('abc-123_def')).toBe(true)
  })

  it('.. 应拒绝', () => {
    expect(isValidProjectCode('../../etc/passwd')).toBe(false)
  })

  it('包含 / 应拒绝', () => {
    expect(isValidProjectCode('abc/def')).toBe(false)
  })

  it('空值应拒绝', () => {
    expect(isValidProjectCode('')).toBe(false)
    expect(isValidProjectCode(null)).toBe(false)
  })
})

describe('isValidFilename', () => {
  it('合法文件名应通过', () => {
    expect(isValidFilename('handoff-20260917.json')).toBe(true)
    expect(isValidFilename('shot-20260917-120000-123.jpg')).toBe(true)
  })

  it('包含 .. 应拒绝', () => {
    expect(isValidFilename('../../etc/passwd')).toBe(false)
  })

  it('包含路径分隔符应拒绝', () => {
    expect(isValidFilename('foo/bar')).toBe(false)
    expect(isValidFilename('foo\\bar')).toBe(false)
  })

  it('以点开头应拒绝', () => {
    expect(isValidFilename('.env')).toBe(false)
  })
})
