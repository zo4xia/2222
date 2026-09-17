#!/usr/bin/env node

/**
 * ABC三轨架构专项检查脚本
 * 
 * 基于项目文档中的ABC ChainKey架构规范进行检查：
 * - A轨 = 语音/文本主轴 (voiceText / spokenScript)
 * - B轨 = 板书指挥/时间轨道 (boardSlice 投影出的指挥片段)  
 * - C轨 = 画布演员/板书视觉对象 (timeline board clip / canvas actor)
 * 
 * 核心检查：chainKey对齐、占位符对齐、身份唯一性
 * 
 * 占位符对齐原则（绝对真相）：
 * - 开场读题 -> A-template-open -> prompt模板层保留B/C占位符（对齐用，即使B/C无内容）
 * - Prompt模板层必须保留完整的三轨占位符：A-template-open / B-template-open / C-template-open、A-template-pre / B-template-pre / C-template-pre、A-template-end / B-template-end / C-template-end
 * - 即使B/C无实际内容，占位符也必须存在，用于防止后续内容往前错位
 * - Compiler输出层根据实际boardSlice内容和chainKey类型决定是否生成正式B/C标签到boardPlan
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path, { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// ABC架构的硬边界规则
const ABC_RULES = {
  // 合法的section类型
  VALID_SECTIONS: [
    'template-open',
    'template-pre',
    'template-end',
    'unbound'
  ],

  // 合法的chainKey身份
  VALID_CHAINKEYS: [
    'A-template-open', 'B-template-open', 'C-template-open',
    'A-template-pre', 'B-template-pre', 'C-template-pre',
    'A-template-end', 'B-template-end', 'C-template-end',
    'A-unbound', 'B-unbound', 'C-unbound'
  ],

  // template-open保留三轨占位；compiler输出层不生成正式B/C内容
  TEMPLATE_OPEN_RULE: {
    'A-template-open': 'ALLOWED',
    'B-template-open': 'PLACEHOLDER_ONLY',
    'C-template-open': 'PLACEHOLDER_ONLY'
  },

  // template-pre可选B/C的规则
  TEMPLATE_PRE_RULE: {
    'A-template-pre': 'ALLOWED',
    'B-template-pre': 'CONDITIONAL',
    'C-template-pre': 'CONDITIONAL'
  }
};

// 需要检查的文件模式
const SCAN_PATTERNS = [
  // Agent prompt文件
  /script.*agent.*prompt\.(ts|tsx|js|jsx|mjs)$/,
  // chainKey相关文件
  /.*chain.*key.*\.(ts|tsx|js|jsx|mjs)$/,
  // script相关文件
  /.*script.*\.(ts|tsx|js|jsx|mjs)$/,
  // board相关文件
  /.*board.*\.(ts|tsx|js|jsx|mjs)$/,
  // timeline相关文件
  /.*timeline.*\.(ts|tsx|js|jsx|mjs)$/
];

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

// 忽略的目录
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.tmp'];

function shouldScanFile(filePath) {
  const ext = extname(filePath);
  if (!SCAN_EXTENSIONS.includes(ext)) return false;

  return SCAN_PATTERNS.some(pattern => pattern.test(filePath));
}

function shouldIgnoreDir(dirPath) {
  return IGNORE_DIRS.some(ignore => dirPath.includes(ignore));
}

// 检查chainKey对齐问题
function checkChainKeyAlignment(content, filePath) {
  const findings = [];

  // 检查非法的chainKey
  const chainKeyRegex = /['"`]?([ABC]-template-(?:open|pre|end)|[ABC]-unbound)['"`]?/g;
  const matches = content.matchAll(chainKeyRegex);

  for (const match of matches) {
    const chainKey = match[1];
    if (!ABC_RULES.VALID_CHAINKEYS.includes(chainKey)) {
      findings.push({
        type: 'INVALID_CHAINKEY',
        file: filePath,
        line: getLineNumber(content, match.index),
        issue: `非法chainKey: ${chainKey}`,
        severity: 'HIGH',
        match: match[0]
      });
    }
  }

  // 检查chainKey唯一性违规
  const duplicateChainKeyRegex = /(chainKey\s*[:=]\s*['"`]([^'"`]+)['"`])/g;
  const chainKeyValues = new Set();
  const duplicateMatches = content.matchAll(duplicateChainKeyRegex);

  for (const match of duplicateMatches) {
    const chainKeyValue = match[2];
    if (chainKeyValues.has(chainKeyValue)) {
      findings.push({
        type: 'DUPLICATE_CHAINKEY',
        file: filePath,
        line: getLineNumber(content, match.index),
        issue: `重复的chainKey值: ${chainKeyValue}`,
        severity: 'CRITICAL',
        match: match[0]
      });
    }
    chainKeyValues.add(chainKeyValue);
  }

  return findings;
}

// 检查占位符对齐问题
function checkPlaceholderAlignment(content, filePath) {
  const findings = [];

  // 检查template-open在compiler输出层违规生成正式B/C
  const templateOpenPattern = /template-open[^]*?B-template-open[^]*?C-template-open/gi;
  const templateOpenMatches = content.matchAll(templateOpenPattern);

  for (const match of templateOpenMatches) {
    // 检查是否在compiler输出层（非prompt模板层）
    if (content.includes('compiler') || content.includes('output')) {
      findings.push({
        type: 'TEMPLATE_OPEN_VIOLATION',
        file: filePath,
        line: getLineNumber(content, match.index),
        issue: 'template-open在compiler输出层不应生成正式B/C标签',
        severity: 'HIGH',
        match: match[0].substring(0, 100) + '...'
      });
    }
  }

  return findings;
}

// 检查section唯一性
function checkSectionUniqueness(content, filePath) {
  const findings = [];

  // 检查非法section - 基于文档中的具体问题
  const invalidSections = ['开场白', '读题', '分析', '步骤一', '步骤二', '步骤三', '开场读题', '分析题目', '解题环节', '梳理总结'];

  // 检查section字段赋值
  const sectionPatterns = [
    /section\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
    /['"`](开场白|读题|分析|步骤一|步骤二|步骤三|开场读题|分析题目|解题环节|梳理总结)['"`]/gi
  ];

  sectionPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const section = match[1];
      if (invalidSections.includes(section)) {
        findings.push({
          type: 'INVALID_SECTION',
          file: filePath,
          line: getLineNumber(content, match.index),
          issue: `非法section: ${section} (应该使用template-open/template-pre/template-end或A1/B1/C1等格式)`,
          severity: 'CRITICAL',
          match: match[0]
        });
      }
    }
  });

  // 检查stepLabel字段是否使用了非法值
  const stepLabelPattern = /stepLabel\s*[:=]\s*['"`]([^'"`]+)['"`]/gi;
  const stepLabelMatches = content.matchAll(stepLabelPattern);

  for (const match of stepLabelMatches) {
    const stepLabel = match[1];
    if (invalidSections.includes(stepLabel)) {
      findings.push({
        type: 'INVALID_STEPLABEL',
        file: filePath,
        line: getLineNumber(content, match.index),
        issue: `非法stepLabel: ${stepLabel} (应该与section规范一致)`,
        severity: 'HIGH',
        match: match[0]
      });
    }
  }

  return findings;
}

// 检查ABC字段对齐
function checkABCFieldAlignment(content, filePath) {
  const findings = [];

  // 检查A/B/C字段混用
  const fieldPatterns = {
    'A轨字段': ['sourceStartMs', 'sourceEndMs', 'sourceRef'],
    'B轨字段': ['startMs', 'endMs'],
    'C轨reveal字段': ['revealStartMs', 'revealEndMs'],
    'C轨visual字段': ['xPercent', 'yPercent', 'widthPercent', 'fontSize', 'drawSpeed']
  };

  // 检查字段是否在正确的轨道中使用
  Object.entries(fieldPatterns).forEach(([trackName, fields]) => {
    fields.forEach(field => {
      const regex = new RegExp(`\\b${field}\\b`, 'g');
      const matches = content.matchAll(regex);

      for (const match of matches) {
        const context = getContextLine(content, match.index);

        // 简单的字段使用检查（可以进一步细化）
        if (trackName.includes('A轨') && (context.includes('boardClip') || context.includes('canvas'))) {
          findings.push({
            type: 'FIELD_MISUSE',
            file: filePath,
            line: getLineNumber(content, match.index),
            issue: `A轨字段${field}在B/C轨上下文中使用`,
            severity: 'MEDIUM',
            match: match[0],
            context
          });
        }
      }
    });
  });

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

function scanFile(filePath) {
  const findings = [];

  try {
    const content = readFileSync(filePath, 'utf8');

    // 执行各种检查
    findings.push(...checkChainKeyAlignment(content, filePath));
    findings.push(...checkPlaceholderAlignment(content, filePath));
    findings.push(...checkSectionUniqueness(content, filePath));
    findings.push(...checkABCFieldAlignment(content, filePath));

  } catch (error) {
    console.warn(`无法读取文件 ${filePath}: ${error.message}`);
  }

  return findings;
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
    }),
    recommendations: []
  };

  // 生成建议
  if (report.summary.critical > 0) {
    report.recommendations.push('立即修复chainKey重复问题，确保身份唯一性');
  }

  if (report.summary.high > 0) {
    report.recommendations.push('检查并修复非法chainKey和section，确保符合ABC架构规范');
  }

  if (report.summary.medium > 0) {
    report.recommendations.push('检查ABC字段使用是否在正确的轨道上下文中');
  }

  return report;
}

function printReport(report) {
  console.log('\n🔗 ABC三轨架构检查报告');
  console.log('='.repeat(50));
  console.log(`扫描时间: ${report.timestamp}`);
  console.log(`总计发现问题: ${report.summary.total}`);
  console.log(`🚨 严重: ${report.summary.critical}`);
  console.log(`⚠️  高危: ${report.summary.high}`);
  console.log(`⚡ 中危: ${report.summary.medium}`);
  console.log(`💡 低危: ${report.summary.low}`);

  if (report.findings.length === 0) {
    console.log('\n✅ ABC架构检查通过');
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

    console.log(`\n${icon} ${index + 1}. ${finding.type} (${finding.severity})`);
    console.log(`   文件: ${finding.file}:${finding.line}`);
    console.log(`   问题: ${finding.issue}`);
    if (finding.context) {
      console.log(`   上下文: ${finding.context}`);
    }
    console.log(`   代码: ${finding.match}`);
  });

  if (report.recommendations.length > 0) {
    console.log('\n🛠️ 修复建议:');
    console.log('-'.repeat(30));
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }

  // ABC架构规范提醒
  console.log('\n📚 ABC架构规范提醒:');
  console.log('- A轨 = 语音/文本主轴 (voiceText / spokenScript)');
  console.log('- B轨 = 板书指挥/时间轨道 (boardSlice 投影出的指挥片段)');
  console.log('- C轨 = 画布演员/板书视觉对象 (timeline board clip / canvas actor)');
  console.log('- chainKey是ABC三轨对齐的唯一标识符');
  console.log('- template-open保留A/B/C占位；compiler输出层不生成正式B/C内容，template-pre可选B/C');
}

// 主执行函数
function main() {
  console.log('🔗 开始ABC三轨架构检查...\n');

  const findings = scanDirectory(projectRoot);
  const report = generateReport(findings);

  printReport(report);

  // 根据检查结果设置退出码
  if (report.summary.critical > 0) {
    process.exit(1); // 发现严重问题，退出码为1
  } else if (report.summary.high > 0) {
    process.exit(2); // 发现高危问题，退出码为2
  } else if (report.summary.medium > 0) {
    process.exit(3); // 发现中危问题，退出码为3
  } else {
    process.exit(0); // ABC架构检查通过
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanDirectory, generateReport, printReport };
