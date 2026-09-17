#!/usr/bin/env node

/**
 * 依赖健康检查脚本
 * 
 * 检查内容：
 * - 依赖版本兼容性
 * - 安全漏洞扫描
 * - 许可证合规性
 * - 依赖大小分析
 * - 过期依赖检测
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 许可证风险等级
const LICENSE_RISK = {
  'MIT': 'LOW',
  'Apache-2.0': 'LOW',
  'BSD-2-Clause': 'LOW',
  'BSD-3-Clause': 'LOW',
  'ISC': 'LOW',
  'CC0-1.0': 'LOW',
  'GPL-2.0': 'MEDIUM',
  'GPL-3.0': 'MEDIUM',
  'LGPL-2.1': 'MEDIUM',
  'LGPL-3.0': 'MEDIUM',
  'AGPL-3.0': 'HIGH',
  'UNLICENSED': 'HIGH',
  'Proprietary': 'HIGH'
};

function readPackageJson() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return packageJson;
  } catch (error) {
    console.error('无法读取 package.json:', error.message);
    process.exit(1);
  }
}

function checkNodeVersion() {
  try {
    const nodeVersion = process.version;
    const packageJson = readPackageJson();
    const requiredVersion = packageJson.engines?.node;
    
    if (requiredVersion) {
      console.log(`📌 Node.js 版本检查:`);
      console.log(`   当前版本: ${nodeVersion}`);
      console.log(`   要求版本: ${requiredVersion}`);
      
      // 简单的版本比较
      const currentMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
      const requiredMajor = parseInt(requiredVersion.slice(2).split('.')[0]);
      
      if (currentMajor < requiredMajor) {
        console.log(`   ⚠️  Node.js 版本过低，建议升级`);
        return false;
      } else {
        console.log(`   ✅ Node.js 版本兼容`);
        return true;
      }
    }
  } catch (error) {
    console.warn('Node.js 版本检查失败:', error.message);
  }
  return true;
}

function checkNpmAudit() {
  console.log('\n🔒 安全漏洞扫描:');
  
  try {
    const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(auditResult);
    
    const vulnerabilities = audit.metadata?.vulnerabilities || {};
    const totalVulns = Object.values(vulnerabilities).reduce((sum, vuln) => sum + vuln, 0);
    
    if (totalVulns === 0) {
      console.log('   ✅ 未发现安全漏洞');
      return { vulnerabilities: 0, high: 0, moderate: 0, low: 0 };
    }
    
    const highVulns = audit.vulnerabilities?.high || 0;
    const moderateVulns = audit.vulnerabilities?.moderate || 0;
    const lowVulns = audit.vulnerabilities?.low || 0;
    
    console.log(`   🚨 发现 ${totalVulns} 个安全漏洞:`);
    console.log(`      严重: ${highVulns}`);
    console.log(`      中等: ${moderateVulns}`);
    console.log(`      轻微: ${lowVulns}`);
    
    // 列出高危漏洞
    if (highVulns > 0) {
      console.log('\n   📋 高危漏洞详情:');
      Object.entries(audit.vulnerabilities || {})
        .filter(([name, data]) => data.severity === 'high')
        .forEach(([name, data]) => {
          console.log(`      - ${name}: ${data.title}`);
        });
    }
    
    return {
      vulnerabilities: totalVulns,
      high: highVulns,
      moderate: moderateVulns,
      low: lowVulns
    };
    
  } catch (error) {
    console.warn('   ⚠️  安全扫描失败:', error.message);
    return { vulnerabilities: -1, error: error.message };
  }
}

function checkOutdatedDependencies() {
  console.log('\n📦 过期依赖检查:');
  
  try {
    const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
    const outdated = JSON.parse(outdatedResult);
    
    if (Object.keys(outdated).length === 0) {
      console.log('   ✅ 所有依赖都是最新版本');
      return { outdated: 0 };
    }
    
    console.log(`   ⚠️  发现 ${Object.keys(outdated).length} 个过期依赖:`);
    
    const outdatedList = [];
    Object.entries(outdated).forEach(([name, data]) => {
      console.log(`      - ${name}: ${data.current} → ${data.latest}`);
      outdatedList.push({
        name,
        current: data.current,
        latest: data.latest,
        type: data.type
      });
    });
    
    return { outdated: outdatedList.length, details: outdatedList };
    
  } catch (error) {
    // npm outdated 在有过期依赖时会返回非零退出码
    if (error.stdout) {
      try {
        const outdated = JSON.parse(error.stdout);
        if (Object.keys(outdated).length > 0) {
          console.log(`   ⚠️  发现 ${Object.keys(outdated).length} 个过期依赖:`);
          
          const outdatedList = [];
          Object.entries(outdated).forEach(([name, data]) => {
            console.log(`      - ${name}: ${data.current} → ${data.latest}`);
            outdatedList.push({
              name,
              current: data.current,
              latest: data.latest,
              type: data.type
            });
          });
          
          return { outdated: outdatedList.length, details: outdatedList };
        }
      } catch (parseError) {
        console.warn('   ⚠️  解析过期依赖信息失败:', parseError.message);
      }
    }
    
    console.log('   ✅ 所有依赖都是最新版本');
    return { outdated: 0 };
  }
}

function analyzeDependencySize() {
  console.log('\n📊 依赖大小分析:');
  
  try {
    // 检查 node_modules 大小
    const { execSync } = require('child_process');
    let nodeModulesSize = 0;
    
    try {
      if (process.platform === 'win32') {
        const result = execSync('du -sh node_modules 2>nul || echo "0"', { encoding: 'utf8' });
        nodeModulesSize = result.trim();
      } else {
        const result = execSync('du -sh node_modules 2>/dev/null || echo "0"', { encoding: 'utf8' });
        nodeModulesSize = result.trim().split('\t')[0];
      }
    } catch (sizeError) {
      nodeModulesSize = '未知';
    }
    
    console.log(`   📦 node_modules 大小: ${nodeModulesSize}`);
    
    // 分析最大的依赖包
    const packageJson = readPackageJson();
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    console.log(`   📋 依赖包数量: ${Object.keys(allDeps).length}`);
    console.log(`      生产依赖: ${Object.keys(packageJson.dependencies || {}).length}`);
    console.log(`      开发依赖: ${Object.keys(packageJson.devDependencies || {}).length}`);
    
    return {
      totalPackages: Object.keys(allDeps).length,
      productionPackages: Object.keys(packageJson.dependencies || {}).length,
      devPackages: Object.keys(packageJson.devDependencies || {}).length,
      nodeModulesSize
    };
    
  } catch (error) {
    console.warn('   ⚠️  依赖大小分析失败:', error.message);
    return { error: error.message };
  }
}

function checkLicenseCompliance() {
  console.log('\n📜 许可证合规检查:');
  
  try {
    const packageJson = readPackageJson();
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const licenseIssues = [];
    let checkedCount = 0;
    
    for (const [name, version] of Object.entries(allDeps)) {
      try {
        // 尝试读取依赖的 package.json
        const depPackagePath = `node_modules/${name}/package.json`;
        if (existsSync(depPackagePath)) {
          const depPackage = JSON.parse(readFileSync(depPackagePath, 'utf8'));
          const license = depPackage.license || 'Unknown';
          const risk = LICENSE_RISK[license] || 'UNKNOWN';
          
          if (risk === 'HIGH' || risk === 'UNKNOWN') {
            licenseIssues.push({
              name,
              version,
              license,
              risk
            });
          }
          
          checkedCount++;
        }
      } catch (error) {
        // 忽略单个包的读取错误
      }
    }
    
    console.log(`   📋 已检查 ${checkedCount} 个包的许可证`);
    
    if (licenseIssues.length === 0) {
      console.log('   ✅ 许可证合规检查通过');
      return { issues: 0 };
    }
    
    console.log(`   ⚠️  发现 ${licenseIssues.length} 个许可证风险:`);
    licenseIssues.forEach(issue => {
      const icon = issue.risk === 'HIGH' ? '🚨' : '⚡';
      console.log(`      ${icon} ${issue.name}@${issue.version}: ${issue.license} (${issue.risk})`);
    });
    
    return { issues: licenseIssues.length, details: licenseIssues };
    
  } catch (error) {
    console.warn('   ⚠️  许可证检查失败:', error.message);
    return { error: error.message };
  }
}

function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: results.nodeVersion,
    security: results.security,
    outdated: results.outdated,
    size: results.size,
    licenses: results.licenses,
    summary: {
      status: 'HEALTHY',
      criticalIssues: 0,
      warnings: 0,
      recommendations: []
    }
  };
  
  // 评估整体健康状态
  if (results.security.vulnerabilities > 0) {
    report.summary.status = results.security.high > 0 ? 'CRITICAL' : 'WARNING';
    report.summary.criticalIssues += results.security.high;
    report.summary.warnings += results.security.moderate + results.security.low;
  }
  
  if (results.outdated.outdated > 5) {
    report.summary.status = 'WARNING';
    report.summary.warnings += results.outdated.outdated;
  }
  
  if (results.licenses.issues > 0) {
    report.summary.status = 'WARNING';
    report.summary.warnings += results.licenses.issues;
  }
  
  // 生成建议
  if (results.security.vulnerabilities > 0) {
    report.summary.recommendations.push('立即修复安全漏洞：npm audit fix');
  }
  
  if (results.outdated.outdated > 0) {
    report.summary.recommendations.push('更新过期依赖：npm update');
  }
  
  if (results.licenses.issues > 0) {
    report.summary.recommendations.push('审查高风险许可证的合规性');
  }
  
  return report;
}

function printSummary(report) {
  console.log('\n' + '='.repeat(50));
  console.log('📋 依赖健康检查总结');
  console.log('='.repeat(50));
  console.log(`检查时间: ${report.timestamp}`);
  console.log(`整体状态: ${report.summary.status}`);
  console.log(`关键问题: ${report.summary.criticalIssues}`);
  console.log(`警告数量: ${report.summary.warnings}`);
  
  if (report.summary.recommendations.length > 0) {
    console.log('\n🛠️ 建议操作:');
    report.summary.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  // 设置退出码
  if (report.summary.status === 'CRITICAL') {
    console.log('\n❌ 依赖健康检查失败（关键问题）');
    process.exit(1);
  } else if (report.summary.status === 'WARNING') {
    console.log('\n⚠️ 依赖健康检查完成（发现问题）');
    process.exit(2);
  } else {
    console.log('\n✅ 依赖健康检查通过');
    process.exit(0);
  }
}

// 主执行函数
function main() {
  console.log('🔍 开始依赖健康检查...\n');
  
  const results = {
    nodeVersion: checkNodeVersion(),
    security: checkNpmAudit(),
    outdated: checkOutdatedDependencies(),
    size: analyzeDependencySize(),
    licenses: checkLicenseCompliance()
  };
  
  const report = generateReport(results);
  printSummary(report);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  readPackageJson, 
  checkNodeVersion, 
  checkNpmAudit, 
  checkOutdatedDependencies,
  analyzeDependencySize,
  checkLicenseCompliance 
};
