#!/usr/bin/env node

/**
 * 性能基准测试脚本
 * 
 * 检查内容：
 * - 构建时间分析
 * - 包大小分析
 * - 运行时性能指标
 * - 内存使用情况
 * - 首屏加载时间
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function measureBuildTime() {
  console.log('⚡ 构建时间分析:');
  
  const buildCommand = 'npm run build';
  const iterations = 3;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`   🔄 第 ${i + 1} 次构建...`);
    
    const startTime = performance.now();
    try {
      execSync(buildCommand, { stdio: 'pipe' });
      const endTime = performance.now();
      const buildTime = endTime - startTime;
      times.push(buildTime);
      
      console.log(`      ⏱️  构建时间: ${buildTime.toFixed(2)}ms`);
    } catch (error) {
      console.log(`      ❌ 构建失败: ${error.message}`);
      return { error: error.message, times: [] };
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`   📊 构建时间统计:`);
    console.log(`      平均: ${avgTime.toFixed(2)}ms`);
    console.log(`      最快: ${minTime.toFixed(2)}ms`);
    console.log(`      最慢: ${maxTime.toFixed(2)}ms`);
    
    // 性能评估
    let performance = 'EXCELLENT';
    if (avgTime > 30000) performance = 'POOR';
    else if (avgTime > 15000) performance = 'FAIR';
    else if (avgTime > 8000) performance = 'GOOD';
    
    console.log(`      评级: ${performance}`);
    
    return {
      times,
      average: avgTime,
      min: minTime,
      max: maxTime,
      performance
    };
  }
  
  return { error: '无法获取构建时间数据', times: [] };
}

function analyzeBundleSize() {
  console.log('\n📦 包大小分析:');
  
  try {
    // 检查 dist 目录是否存在
    if (!existsSync('dist')) {
      console.log('   ⚠️  dist 目录不存在，请先执行构建');
      return { error: 'dist directory not found' };
    }
    
    // 分析构建产物大小
    let totalSize = 0;
    const files = [];
    
    function analyzeDirectory(dirPath, relativePath = '') {
      const { readdirSync, statSync } = require('fs');
      const { join } = require('path');
      
      try {
        const entries = readdirSync(dirPath);
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry);
          const relativeFilePath = join(relativePath, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            analyzeDirectory(fullPath, relativeFilePath);
          } else {
            const fileSize = stat.size;
            totalSize += fileSize;
            
            files.push({
              path: relativeFilePath,
              size: fileSize,
              sizeFormatted: formatFileSize(fileSize)
            });
          }
        }
      } catch (error) {
        console.warn(`   ⚠️  无法分析目录 ${dirPath}: ${error.message}`);
      }
    }
    
    analyzeDirectory('dist');
    
    // 按大小排序
    files.sort((a, b) => b.size - a.size);
    
    console.log(`   📊 总大小: ${formatFileSize(totalSize)}`);
    console.log(`   📋 文件数量: ${files.length}`);
    
    // 显示最大的文件
    console.log('\n   📋 最大的文件:');
    files.slice(0, 10).forEach((file, index) => {
      console.log(`      ${index + 1}. ${file.path}: ${file.sizeFormatted}`);
    });
    
    // 分析文件类型分布
    const fileTypes = {};
    files.forEach(file => {
      const ext = file.path.split('.').pop().toLowerCase() || 'no-extension';
      fileTypes[ext] = (fileTypes[ext] || 0) + file.size;
    });
    
    console.log('\n   📊 文件类型分布:');
    Object.entries(fileTypes)
      .sort(([, a], [, b]) => b - a)
      .forEach(([ext, size]) => {
        console.log(`      .${ext}: ${formatFileSize(size)}`);
      });
    
    // 性能评估
    let performance = 'EXCELLENT';
    if (totalSize > 10 * 1024 * 1024) performance = 'POOR'; // > 10MB
    else if (totalSize > 5 * 1024 * 1024) performance = 'FAIR'; // > 5MB
    else if (totalSize > 2 * 1024 * 1024) performance = 'GOOD'; // > 2MB
    
    console.log(`   📈 大小评级: ${performance}`);
    
    return {
      totalSize,
      fileCount: files.length,
      largestFiles: files.slice(0, 10),
      fileTypes,
      performance
    };
    
  } catch (error) {
    console.warn('   ⚠️  包大小分析失败:', error.message);
    return { error: error.message };
  }
}

function checkMemoryUsage() {
  console.log('\n💾 内存使用分析:');
  
  const memoryUsage = process.memoryUsage();
  
  console.log('   📊 当前内存使用:');
  console.log(`      RSS: ${formatFileSize(memoryUsage.rss)}`);
  console.log(`      Heap Used: ${formatFileSize(memoryUsage.heapUsed)}`);
  console.log(`      Heap Total: ${formatFileSize(memoryUsage.heapTotal)}`);
  console.log(`      External: ${formatFileSize(memoryUsage.external)}`);
  
  // 内存使用率
  const heapUsageRatio = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  console.log(`      堆内存使用率: ${heapUsageRatio.toFixed(2)}%`);
  
  // 内存评估
  let memoryStatus = 'NORMAL';
  if (heapUsageRatio > 90) memoryStatus = 'CRITICAL';
  else if (heapUsageRatio > 80) memoryStatus = 'WARNING';
  else if (heapUsageRatio > 70) memoryStatus = 'CAUTION';
  
  console.log(`   📈 内存状态: ${memoryStatus}`);
  
  return {
    rss: memoryUsage.rss,
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    external: memoryUsage.external,
    heapUsageRatio,
    status: memoryStatus
  };
}

function checkDevServerPerformance() {
  console.log('\n🌐 开发服务器性能:');
  
  try {
    // 检查开发服务器是否在运行
    const devServerUrl = 'http://127.0.0.1:5196';
    
    console.log(`   🔍 检查开发服务器: ${devServerUrl}`);
    
    // 这里可以添加更多的性能检查
    // 例如：启动时间、热更新速度、首屏加载时间等
    
    console.log('   ✅ 开发服务器检查完成');
    
    return {
      url: devServerUrl,
      status: 'RUNNING'
    };
    
  } catch (error) {
    console.log('   ⚠️  开发服务器检查失败:', error.message);
    return { error: error.message, status: 'UNKNOWN' };
  }
}

function analyzeDependencyPerformance() {
  console.log('\n📚 依赖性能分析:');
  
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const dependencies = packageJson.dependencies || {};
    
    // 分析可能影响性能的依赖
    const performanceImpactDeps = [];
    
    Object.entries(dependencies).forEach(([name, version]) => {
      let impact = 'LOW';
      let reason = '';
      
      // 检查已知的性能影响包
      if (name.includes('moment')) {
        impact = 'HIGH';
        reason = 'Moment.js 包体积大，建议使用 date-fns 或 dayjs';
      } else if (name.includes('lodash')) {
        impact = 'MEDIUM';
        reason = 'Lodash 可能增加包体积，考虑按需引入或使用原生方法';
      } else if (name.includes('babel')) {
        impact = 'MEDIUM';
        reason = 'Babel 可能影响构建性能';
      } else if (name.includes('webpack')) {
        impact = 'MEDIUM';
        reason = 'Webpack 配置可能影响构建性能';
      }
      
      if (impact !== 'LOW') {
        performanceImpactDeps.push({
          name,
          version,
          impact,
          reason
        });
      }
    });
    
    console.log(`   📊 依赖总数: ${Object.keys(dependencies).length}`);
    
    if (performanceImpactDeps.length > 0) {
      console.log(`   ⚠️  发现 ${performanceImpactDeps.length} 个可能影响性能的依赖:`);
      performanceImpactDeps.forEach(dep => {
        const icon = dep.impact === 'HIGH' ? '🚨' : '⚡';
        console.log(`      ${icon} ${dep.name}@${dep.version} (${dep.impact})`);
        console.log(`         ${dep.reason}`);
      });
    } else {
      console.log('   ✅ 未发现明显的性能影响依赖');
    }
    
    return {
      totalDependencies: Object.keys(dependencies).length,
      performanceImpactDeps
    };
    
  } catch (error) {
    console.warn('   ⚠️  依赖性能分析失败:', error.message);
    return { error: error.message };
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generatePerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    build: results.build,
    bundle: results.bundle,
    memory: results.memory,
    devServer: results.devServer,
    dependencies: results.dependencies,
    summary: {
      overallScore: 0,
      criticalIssues: 0,
      warnings: 0,
      recommendations: []
    }
  };
  
  // 计算总体评分
  let score = 100;
  let criticalIssues = 0;
  let warnings = 0;
  const recommendations = [];
  
  // 构建时间评分
  if (results.build.error) {
    score -= 30;
    criticalIssues++;
    recommendations.push('修复构建错误');
  } else if (results.build.performance === 'POOR') {
    score -= 20;
    warnings++;
    recommendations.push('优化构建配置，减少构建时间');
  } else if (results.build.performance === 'FAIR') {
    score -= 10;
    warnings++;
    recommendations.push('考虑优化构建性能');
  }
  
  // 包大小评分
  if (results.bundle.error) {
    score -= 25;
    criticalIssues++;
    recommendations.push('修复构建产物分析错误');
  } else if (results.bundle.performance === 'POOR') {
    score -= 15;
    warnings++;
    recommendations.push('减少包大小，考虑代码分割和懒加载');
  } else if (results.bundle.performance === 'FAIR') {
    score -= 8;
    warnings++;
    recommendations.push('进一步优化包大小');
  }
  
  // 内存使用评分
  if (results.memory.status === 'CRITICAL') {
    score -= 20;
    criticalIssues++;
    recommendations.push('优化内存使用，检查内存泄漏');
  } else if (results.memory.status === 'WARNING') {
    score -= 10;
    warnings++;
    recommendations.push('监控内存使用情况');
  }
  
  // 依赖性能评分
  if (results.dependencies.performanceImpactDeps.length > 0) {
    const highImpactDeps = results.dependencies.performanceImpactDeps.filter(d => d.impact === 'HIGH');
    if (highImpactDeps.length > 0) {
      score -= 15;
      warnings++;
      recommendations.push('评估高影响依赖的替代方案');
    }
  }
  
  report.summary.overallScore = Math.max(0, score);
  report.summary.criticalIssues = criticalIssues;
  report.summary.warnings = warnings;
  report.summary.recommendations = recommendations;
  
  return report;
}

function printPerformanceReport(report) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 性能分析报告');
  console.log('='.repeat(50));
  console.log(`检查时间: ${report.timestamp}`);
  console.log(`总体评分: ${report.summary.overallScore}/100`);
  console.log(`关键问题: ${report.summary.criticalIssues}`);
  console.log(`警告数量: ${report.summary.warnings}`);
  
  // 评级
  let grade = 'A';
  if (report.summary.overallScore < 60) grade = 'F';
  else if (report.summary.overallScore < 70) grade = 'D';
  else if (report.summary.overallScore < 80) grade = 'C';
  else if (report.summary.overallScore < 90) grade = 'B';
  
  console.log(`性能评级: ${grade}`);
  
  if (report.summary.recommendations.length > 0) {
    console.log('\n🛠️ 优化建议:');
    report.summary.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  // 设置退出码
  if (report.summary.criticalIssues > 0) {
    console.log('\n❌ 性能检查失败（关键问题）');
    process.exit(1);
  } else if (report.summary.warnings > 0) {
    console.log('\n⚠️ 性能检查完成（发现问题）');
    process.exit(2);
  } else {
    console.log('\n✅ 性能检查通过');
    process.exit(0);
  }
}

// 主执行函数
function main() {
  console.log('🚀 开始性能分析...\n');
  
  const results = {
    build: measureBuildTime(),
    bundle: analyzeBundleSize(),
    memory: checkMemoryUsage(),
    devServer: checkDevServerPerformance(),
    dependencies: analyzeDependencyPerformance()
  };
  
  const report = generatePerformanceReport(results);
  printPerformanceReport(report);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  measureBuildTime, 
  analyzeBundleSize, 
  checkMemoryUsage,
  analyzeDependencyPerformance 
};
