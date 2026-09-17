#!/usr/bin/env node

/**
 * 安全扫描脚本 - 检查硬编码密钥和敏感信息
 * 
 * 扫描目标：
 * - API密钥、密码、Token
 * - 数据库连接字符串
 * - 私钥、证书
 * - 硬编码的URL和端点
 * - 调试信息泄露
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path, { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// 敏感信息正则表达式模式
const SECURITY_PATTERNS = [
  // API密钥模式
  {
    name: 'API Key',
    pattern: /['"`]?([A-Za-z0-9_-]{20,})['"`]?\s*[:=]\s*['"`]([A-Za-z0-9_-]{16,})['"`]/g,
    severity: 'HIGH',
    description: '疑似硬编码API密钥'
  },
  // 密码模式
  {
    name: 'Password',
    pattern: /password\s*[:=]\s*['"`]([^'"`]{4,})['"`]/gi,
    severity: 'HIGH',
    description: '硬编码密码'
  },
  // JWT Token
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: 'HIGH',
    description: '硬编码JWT Token'
  },
  // 数据库连接字符串
  {
    name: 'Database URL',
    pattern: /(mongodb|mysql|postgresql|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
    severity: 'HIGH',
    description: '数据库连接字符串'
  },
  // 私钥模式
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    severity: 'CRITICAL',
    description: '私钥文件'
  },
  // AWS访问密钥
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'HIGH',
    description: 'AWS访问密钥'
  },
  // 调试信息
  {
    name: 'Debug Info',
    pattern: /console\.(log|debug|info|warn|error)\s*\([^)]*\)/g,
    severity: 'LOW',
    description: '调试信息泄露'
  },
  // 硬编码URL
  {
    name: 'Hardcoded URL',
    pattern: /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)[^\s]*/g,
    severity: 'MEDIUM',
    description: '硬编码本地URL'
  }
];

// 需要扫描的文件扩展名
const SCAN_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '.env', '.config.js', '.config.ts'];

// 忽略的目录
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.tmp'];

function shouldScanFile(filePath) {
  const ext = extname(filePath);
  return SCAN_EXTENSIONS.includes(ext);
}

function shouldIgnoreDir(dirPath) {
  return IGNORE_DIRS.some(ignore => dirPath.includes(ignore));
}

function scanFile(filePath) {
  const findings = [];
  
  try {
    const content = readFileSync(filePath, 'utf8');
    
    SECURITY_PATTERNS.forEach(rule => {
      const matches = content.matchAll(rule.pattern);
      for (const match of matches) {
        findings.push({
          file: filePath,
          line: getLineNumber(content, match.index),
          rule: rule.name,
          severity: rule.severity,
          description: rule.description,
          match: match[0],
          context: getContextLine(content, match.index)
        });
      }
    });
  } catch (error) {
    console.warn(`无法读取文件 ${filePath}: ${error.message}`);
  }
  
  return findings;
}

function getLineNumber(content, index) {
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

function getContextLine(content, index) {
  const lines = content.split('\n');
  const lineIndex = content.substring(0, index).split('\n').length - 1;
  return lines[lineIndex]?.trim() || '';
}

function scanDirectory(dirPath) {
  const allFindings = [];
  
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldIgnoreDir(fullPath)) {
          allFindings.push(...scanDirectory(fullPath));
        }
      } else if (stat.isFile() && shouldScanFile(fullPath)) {
        allFindings.push(...scanFile(fullPath));
      }
    }
  } catch (error) {
    console.warn(`无法扫描目录 ${dirPath}: ${error.message}`);
  }
  
  return allFindings;
}

function generateReport(findings) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length
    },
    findings: findings.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
  };
  
  return report;
}

function printReport(report) {
  console.log('\n🔒 安全扫描报告');
  console.log('='.repeat(50));
  console.log(`扫描时间: ${report.timestamp}`);
  console.log(`总计发现问题: ${report.summary.total}`);
  console.log(`🚨 严重: ${report.summary.critical}`);
  console.log(`⚠️  高危: ${report.summary.high}`);
  console.log(`⚡ 中危: ${report.summary.medium}`);
  console.log(`💡 低危: ${report.summary.low}`);
  
  if (report.findings.length === 0) {
    console.log('\n✅ 未发现安全问题');
    return;
  }
  
  console.log('\n📋 详细问题列表:');
  console.log('-'.repeat(50));
  
  report.findings.forEach((finding, index) => {
    const icon = {
      CRITICAL: '🚨',
      HIGH: '⚠️',
      MEDIUM: '⚡',
      LOW: '💡'
    }[finding.severity];
    
    console.log(`\n${icon} ${index + 1}. ${finding.rule} (${finding.severity})`);
    console.log(`   文件: ${finding.file}:${finding.line}`);
    console.log(`   描述: ${finding.description}`);
    console.log(`   代码: ${finding.match}`);
    console.log(`   上下文: ${finding.context}`);
  });
  
  // 修复建议
  console.log('\n🛠️ 修复建议:');
  console.log('-'.repeat(30));
  
  if (report.summary.critical > 0 || report.summary.high > 0) {
    console.log('1. 立即移除硬编码的密钥和密码');
    console.log('2. 使用环境变量或密钥管理服务');
    console.log('3. 将敏感信息添加到 .gitignore');
    console.log('4. 轮换已泄露的密钥');
  }
  
  if (report.summary.medium > 0) {
    console.log('5. 使用配置文件管理URL和端点');
    console.log('6. 区分开发和生产环境配置');
  }
  
  if (report.summary.low > 0) {
    console.log('7. 移除生产环境的调试信息');
    console.log('8. 使用专业的日志管理工具');
  }
}

// 主执行函数
function main() {
  console.log('🔍 开始安全扫描...');
  
  const findings = scanDirectory(projectRoot);
  const report = generateReport(findings);
  
  printReport(report);
  
  // 根据扫描结果设置退出码
  if (report.summary.critical > 0 || report.summary.high > 0) {
    process.exit(1); // 发现高危问题，退出码为1
  } else if (report.summary.medium > 0) {
    process.exit(2); // 发现中危问题，退出码为2
  } else {
    process.exit(0); // 安全扫描通过
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanDirectory, generateReport, printReport };
