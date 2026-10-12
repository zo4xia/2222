#!/usr/bin/env node
/**
 * verify_layout_report.js — 浏览器实测产物复核
 *
 * 输入：msedge --dump-dom "file:///.../board-lecture-XXX.html?audit=1" > dom.txt
 *
 * 页面职责：在 ?audit=1 时往 DOM 注入两段 JSON（id 固定）：
 *   __LAYOUT_REPORT__  布局自报  [{id,rowIdx,block,x,y,w,h,fontSize}]
 *   __RECT__           真实 rect  [{id,x,y,w,h}]   ← getBoundingClientRect() 换算回画布百分比
 *
 * 本脚本做三件肉眼不可靠的事：
 *   ① 自报 vs 真实偏差（默认阈值 0.3%）
 *   ② rect 两两重叠检测（用 x/y 区间交叠判定，不靠肉眼——并排列同基线在截图里像连成一行）
 *   ③ 溢出画布检测（画布百分比 0~100）
 *
 * 用法：
 *   node verify_layout_report.js dom.txt [--tol 0.3] [--json]
 *
 * 退出码：0 = PASS，1 = FAIL，2 = 用法/解析错误
 *
 * 更新时间：2026-09-19 00:03 GMT+8
 * 更新人：小阿星 ✦（代表夏夏）
 * 来源：references/render-downstream.md §3 + v1.3「验证三件套」第 3 条
 * 本项目定位：board-lecture-player/scripts/verify_layout_report.js
 * 版本：v1.0
 */

'use strict';

const fs = require('fs');

const errors = [];
const warns = [];

function unescapeHtml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** 从任意标签里按 id 抽出文本内容 */
function extractById(html, id) {
  const tagRe = new RegExp(`<([a-zA-Z]+)[^>]*\\bid=["']?${id}["']?[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  const m = html.match(tagRe);
  if (!m) return null;
  return unescapeHtml(m[2]).trim();
}

function overlaps(a, b, eps = 0) {
  return (
    a.x < b.x + b.w - eps &&
    b.x < a.x + a.w - eps &&
    a.y < b.y + b.h - eps &&
    b.y < a.y + a.h - eps
  );
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const tolIdx = argv.indexOf('--tol');
  const tol = tolIdx >= 0 ? parseFloat(argv[tolIdx + 1]) : 0.3;
  const file = argv.find((a) => !a.startsWith('--') && !(!isNaN(parseFloat(a)) && argv[argv.indexOf(a) - 1] === '--tol'));

  if (!file) {
    console.error('用法: node verify_layout_report.js <dom.txt> [--tol 0.3] [--json]');
    process.exit(2);
  }

  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`读取失败: ${e.message}`);
    process.exit(2);
  }

  const parseBlock = (id) => {
    const raw = extractById(html, id);
    if (!raw) {
      errors.push(`DOM 里找不到 #${id}。页面必须在 ?audit=1 时注入它`);
      return [];
    }
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) {
      errors.push(`#${id} 不是合法 JSON: ${e.message}`);
      return [];
    }
  };

  const report = parseBlock('__LAYOUT_REPORT__');
  const rects = parseBlock('__RECT__');

  // ① 偏差对照
  const rectMap = new Map(rects.map((r) => [String(r.id), r]));
  const missing = [];
  let maxDev = 0;

  for (const it of report) {
    const r = rectMap.get(String(it.id));
    if (!r) {
      missing.push(it.id);
      continue;
    }
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof it[k] !== 'number' || typeof r[k] !== 'number') continue;
      const dev = Math.abs(it[k] - r[k]);
      if (dev > maxDev) maxDev = dev;
      if (dev > tol) {
        errors.push(`#${it.id}.${k} 自报 ${it[k]} vs 真实 ${r[k]}，偏差 ${dev.toFixed(3)}% > ${tol}%`);
      }
    }
  }
  if (missing.length) errors.push(`以下 id 在 __RECT__ 里没有真实测量值：${missing.join(', ')}`);

  // ② 重叠（以真实 rect 为准，自报会骗人）
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (overlaps(a, b, 0.05)) {
        errors.push(`板书块重叠：#${a.id}(${a.x},${a.y},${a.w},${a.h}) × #${b.id}(${b.x},${b.y},${b.w},${b.h})`);
      }
    }
  }

  // ③ 溢出画布
  for (const r of rects) {
    if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > 100.5 || r.y + r.h > 100.5) {
      errors.push(`#${r.id} 溢出画布：(${r.x},${r.y},${r.w},${r.h})`);
    }
    if (typeof r.fontSize === 'number' && r.fontSize < 24) {
      warns.push(`#${r.id} 字号 ${r.fontSize}px 偏小，讲义类建议 ≥24px；若被迫降级属规格冲突，应上报而非静默接受`);
    }
  }

  const out = [
    `== verify_layout_report ==  file=${file}`,
    `自报 ${report.length} 项 / 真实 ${rects.length} 项 / 阈值 ${tol}% / 最大偏差 ${maxDev.toFixed(3)}%`,
    `ERROR: ${errors.length}   WARN: ${warns.length}`,
  ];
  if (errors.length) out.push('', '-- ERROR --', ...errors.map((e) => `  ✗ ${e}`));
  if (warns.length) out.push('', '-- WARN --', ...warns.map((w) => `  ! ${w}`));
  out.push('', errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');

  if (asJson) {
    console.log(JSON.stringify({ pass: errors.length === 0, errors, warns, maxDev, report: report.length, rects: rects.length }, null, 2));
  } else {
    console.log(out.join('\n'));
  }
  process.exit(errors.length ? 1 : 0);
}

main();
