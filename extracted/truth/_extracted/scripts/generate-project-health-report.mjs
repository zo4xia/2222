#!/usr/bin/env node

/**
 * 项目健康报告生成器
 * 
 * 综合所有检查脚本的结果，生成完整的项目健康报告
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入检查函数
import { 
  scanDirectory, 
  generateReport as generateSecurityReport 
} from './check-security-secrets.mjs';

import { 
  readPackageJson, 
  checkNodeVersion, 
  checkNpmAudit, 
  checkOutdatedDependencies,
  analyzeDependencySize,
  checkLicenseCompliance 
} from './check-dependencies.mjs';

import { 
  measureBuildTime, 
  analyzeBundleSize, 
  checkMemoryUsage,
  analyzeDependencyPerformance 
} from './check-performance.mjs';

// 项目元数据
function getProjectMetadata() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const gitInfo = getGitInfo();
    
    return {
      name: packageJson.name || 'Unknown',
      version: packageJson.version || '0.0.0',
      description: packageJson.description || '',
      author: packageJson.author || '',
      license: packageJson.license || '',
      engines: packageJson.engines || {},
      scripts: packageJson.scripts || {},
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      ...gitInfo
    };
  } catch (error) {
    console.warn('获取项目元数据失败:', error.message);
    return {
      name: 'Unknown',
      version: '0.0.0',
      error: error.message
    };
  }
}

function getGitInfo() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const commitDate = execSync('git log -1 --format=%cd', { encoding: 'utf8' }).trim();
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    
    return {
      git: {
        branch,
        commit,
        commitDate,
        remoteUrl
      }
    };
  } catch (error) {
    return {
      git: {
        error: 'Git信息获取失败'
      }
    };
  }
}

// 技术栈分析
function analyzeTechStack(metadata) {
  const techStack = {
    frontend: [],
    backend: [],
    build: [],
    testing: [],
    other: []
  };
  
  const deps = { ...metadata.dependencies, ...metadata.devDependencies };
  
  Object.keys(deps).forEach(dep => {
    if (dep.startsWith('react') || dep.startsWith('vue') || dep.startsWith('angular')) {
      techStack.frontend.push(dep);
    } else if (dep.includes('express') || dep.includes('koa') || dep.includes('fastify')) {
      techStack.backend.push(dep);
    } else if (dep.includes('vite') || dep.includes('webpack') || dep.includes('rollup')) {
      techStack.build.push(dep);
    } else if (dep.includes('jest') || dep.includes('mocha') || dep.includes('playwright') || dep.includes('cypress')) {
      techStack.testing.push(dep);
    } else {
      techStack.other.push(dep);
    }
  });
  
  return techStack;
}

// 执行所有检查
async function runAllChecks() {
  console.log('🔍 开始执行项目健康检查...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    metadata: getProjectMetadata(),
    techStack: null,
    security: null,
    dependencies: null,
    performance: null,
    codeQuality: null
  };
  
  // 技术栈分析
  results.techStack = analyzeTechStack(results.metadata);
  
  // 安全检查
  console.log('🔒 执行安全检查...');
  try {
    const securityFindings = scanDirectory('.');
    results.security = generateSecurityReport(securityFindings);
  } catch (error) {
    results.security = { error: error.message };
  }
  
  // 依赖检查
  console.log('📦 执行依赖检查...');
  try {
    results.dependencies = {
      nodeVersion: checkNodeVersion(),
      security: checkNpmAudit(),
      outdated: checkOutdatedDependencies(),
      size: analyzeDependencySize(),
      licenses: checkLicenseCompliance()
    };
  } catch (error) {
    results.dependencies = { error: error.message };
  }
  
  // 性能检查
  console.log('⚡ 执行性能检查...');
  try {
    results.performance = {
      build: measureBuildTime(),
      bundle: analyzeBundleSize(),
      memory: checkMemoryUsage(),
      dependencies: analyzeDependencyPerformance()
    };
  } catch (error) {
    results.performance = { error: error.message };
  }
  
  // 代码质量检查（使用现有的脚本）
  console.log('📋 执行代码质量检查...');
  try {
    const typecheckResult = execSync('npm run typecheck', { encoding: 'utf8' });
    results.codeQuality = {
      typecheck: { success: true, output: typecheckResult }
    };
  } catch (error) {
    results.codeQuality = {
      typecheck: { success: false, error: error.message }
    };
  }
  
  return results;
}

// 生成健康评分
function calculateHealthScore(results) {
  let score = 100;
  const issues = [];
  
  // 安全评分 (权重: 25%)
  if (results.security.error) {
    score -= 25;
    issues.push('安全检查执行失败');
  } else {
    const criticalSecurity = results.security.summary.critical;
    const highSecurity = results.security.summary.high;
    
    if (criticalSecurity > 0) {
      score -= 25;
      issues.push(`发现 ${criticalSecurity} 个严重安全问题`);
    } else if (highSecurity > 0) {
      score -= 15;
      issues.push(`发现 ${highSecurity} 个高危安全问题`);
    } else if (results.security.summary.total > 0) {
      score -= 5;
      issues.push(`发现 ${results.security.summary.total} 个安全问题`);
    }
  }
  
  // 依赖评分 (权重: 20%)
  if (results.dependencies.error) {
    score -= 20;
    issues.push('依赖检查执行失败');
  } else {
    if (results.dependencies.security.vulnerabilities > 0) {
      score -= 15;
      issues.push('依赖存在安全漏洞');
    }
    
    if (results.dependencies.outdated.outdated > 5) {
      score -= 5;
      issues.push('存在多个过期依赖');
    }
    
    if (results.dependencies.licenses.issues > 0) {
      score -= 5;
      issues.push('存在许可证风险');
    }
  }
  
  // 性能评分 (权重: 20%)
  if (results.performance.error) {
    score -= 20;
    issues.push('性能检查执行失败');
  } else {
    if (results.performance.build.error) {
      score -= 10;
      issues.push('构建失败');
    } else if (results.performance.build.performance === 'POOR') {
      score -= 8;
      issues.push('构建性能较差');
    }
    
    if (results.performance.bundle.error) {
      score -= 5;
      issues.push('包大小分析失败');
    } else if (results.performance.bundle.performance === 'POOR') {
      score -= 7;
      issues.push('包大小过大');
    }
  }
  
  // 代码质量评分 (权重: 20%)
  if (results.codeQuality.typecheck.success === false) {
    score -= 20;
    issues.push('TypeScript 类型检查失败');
  }
  
  // 项目结构评分 (权重: 15%)
  if (!results.metadata.name || results.metadata.name === 'Unknown') {
    score -= 5;
    issues.push('项目信息不完整');
  }
  
  if (Object.keys(results.metadata.dependencies).length === 0) {
    score -= 5;
    issues.push('缺少依赖配置');
  }
  
  return {
    score: Math.max(0, score),
    grade: getGrade(score),
    issues
  };
}

function getGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D+';
  if (score >= 40) return 'D';
  if (score >= 35) return 'D-';
  return 'F';
}

// 生成报告内容
function generateReportContent(results, healthScore) {
  const report = {
    metadata: {
      generated: new Date().toISOString(),
      projectName: results.metadata.name,
      version: results.metadata.version,
      healthScore: healthScore.score,
      grade: healthScore.grade
    },
    summary: {
      overallHealth: healthScore.score >= 80 ? 'HEALTHY' : healthScore.score >= 60 ? 'WARNING' : 'CRITICAL',
      criticalIssues: healthScore.issues.filter(i => i.includes('严重') || i.includes('失败')).length,
      warnings: healthScore.issues.filter(i => !i.includes('严重') && !i.includes('失败')).length,
      recommendations: generateRecommendations(results, healthScore)
    },
    details: {
      project: results.metadata,
      techStack: results.techStack,
      security: results.security,
      dependencies: results.dependencies,
      performance: results.performance,
      codeQuality: results.codeQuality
    },
    issues: healthScore.issues
  };
  
  return report;
}

function generateRecommendations(results, healthScore) {
  const recommendations = [];
  
  // 安全建议
  if (results.security.summary?.critical > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: '安全',
      title: '立即修复严重安全问题',
      description: '移除硬编码密钥，修复安全漏洞'
    });
  }
  
  // 依赖建议
  if (results.dependencies.security?.vulnerabilities > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: '依赖',
      title: '修复依赖安全漏洞',
      description: '运行 npm audit fix 修复已知漏洞'
    });
  }
  
  if (results.dependencies.outdated?.outdated > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: '依赖',
      title: '更新过期依赖',
      description: '运行 npm update 更新过期依赖包'
    });
  }
  
  // 性能建议
  if (results.performance.build?.performance === 'POOR') {
    recommendations.push({
      priority: 'MEDIUM',
      category: '性能',
      title: '优化构建性能',
      description: '检查构建配置，减少构建时间'
    });
  }
  
  if (results.performance.bundle?.performance === 'POOR') {
    recommendations.push({
      priority: 'MEDIUM',
      category: '性能',
      title: '减少包大小',
      description: '实施代码分割和懒加载策略'
    });
  }
  
  // 代码质量建议
  if (results.codeQuality.typecheck?.success === false) {
    recommendations.push({
      priority: 'HIGH',
      category: '代码质量',
      title: '修复TypeScript类型错误',
      description: '确保所有代码通过类型检查'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// 生成Markdown报告
function generateMarkdownReport(report) {
  return `
# 项目健康报告

## 📊 总体概况

- **项目名称**: ${report.metadata.projectName}
- **版本**: ${report.metadata.version}
- **健康评分**: ${report.metadata.healthScore}/100 (${report.metadata.grade})
- **生成时间**: ${report.metadata.generated}
- **整体状态**: ${report.summary.overallHealth}

## 🎯 关键指标

| 指标 | 状态 | 详情 |
|------|------|------|
| 严重问题 | ${report.summary.criticalIssues} | 需要立即处理 |
| 警告 | ${report.summary.warnings} | 建议尽快处理 |
| 健康评分 | ${report.metadata.healthScore}/100 | ${report.metadata.grade}级 |

## 🛠️ 优先修复建议

${report.summary.recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} [${rec.priority}]

**类别**: ${rec.category}  
**描述**: ${rec.description}
`).join('')}

## 📋 技术栈

${Object.entries(report.details.techStack).map(([category, packages]) => `
**${category}**: ${packages.join(', ') || '无'}
`).join('')}

## 🔍 详细检查结果

### 安全检查
${report.details.security.error ? `❌ 检查失败: ${report.details.security.error}` : `
- 总问题数: ${report.details.security.summary.total}
- 严重: ${report.details.security.summary.critical}
- 高危: ${report.details.security.summary.high}
- 中危: ${report.details.security.summary.medium}
- 低危: ${report.details.security.summary.low}
`}

### 依赖检查
${report.details.dependencies.error ? `❌ 检查失败: ${report.details.dependencies.error}` : `
- Node.js版本: ${report.details.dependencies.nodeVersion ? '✅ 兼容' : '⚠️ 需检查'}
- 安全漏洞: ${report.details.dependencies.security.vulnerabilities}
- 过期依赖: ${report.details.dependencies.outdated.outdated}
- 许可证问题: ${report.details.dependencies.licenses.issues}
`}

### 性能检查
${report.details.performance.error ? `❌ 检查失败: ${report.details.performance.error}` : `
- 构建性能: ${report.details.performance.build.performance || '未知'}
- 包大小: ${report.details.performance.bundle.performance || '未知'}
- 内存使用: ${report.details.performance.memory.status || '未知'}
`}

### 代码质量
${report.details.codeQuality.typecheck.success ? '✅ TypeScript检查通过' : '❌ TypeScript检查失败'}

## 📝 问题清单

${report.issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

---

*报告由自动化工具生成 - ${report.metadata.generated}*
`;
}

// 主执行函数
async function main() {
  console.log('🏥 开始生成项目健康报告...\n');
  
  try {
    // 执行所有检查
    const results = await runAllChecks();
    
    // 计算健康评分
    const healthScore = calculateHealthScore(results);
    
    // 生成报告
    const report = generateReportContent(results, healthScore);
    
    // 保存报告
    const reportPath = `project-health-report-${new Date().toISOString().split('T')[0]}.md`;
    writeFileSync(reportPath, generateMarkdownReport(report));
    
    // 输出摘要
    console.log('\n' + '='.repeat(50));
    console.log('🏥 项目健康报告生成完成');
    console.log('='.repeat(50));
    console.log(`健康评分: ${healthScore.score}/100 (${healthScore.grade})`);
    console.log(`整体状态: ${healthScore.score >= 80 ? 'HEALTHY' : healthScore.score >= 60 ? 'WARNING' : 'CRITICAL'}`);
    console.log(`问题数量: ${healthScore.issues.length}`);
    console.log(`报告文件: ${reportPath}`);
    
    if (healthScore.issues.length > 0) {
      console.log('\n⚠️ 主要问题:');
      healthScore.issues.slice(0, 5).forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    // 设置退出码
    if (healthScore.score < 60) {
      console.log('\n❌ 项目健康状况较差，需要立即处理');
      process.exit(1);
    } else if (healthScore.score < 80) {
      console.log('\n⚠️ 项目存在一些问题，建议及时处理');
      process.exit(2);
    } else {
      console.log('\n✅ 项目健康状况良好');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ 生成健康报告失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runAllChecks, calculateHealthScore, generateReportContent };
