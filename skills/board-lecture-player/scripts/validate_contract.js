#!/usr/bin/env node
/**
 * validate_contract.js — board-lecture-player 上游产出端合同校验
 *
 * 零依赖（仅 Node 标准库）。检查三条非协商修订 + 一期动作收口。
 *
 * 用法：
 *   node validate_contract.js <rows.json>
 *   node validate_contract.js <rows.json> --json      # 机读输出
 *
 * 退出码：0 = PASS（无 ERROR），1 = 有 ERROR，2 = 用法/解析错误
 *
 * 更新时间：2026-09-18 23:59 GMT+8
 * 更新人：小阿星 ✦（代表夏夏）
 * 来源：references/contract-upstream.md（该文件的机器执行版）
 * 本项目定位：board-lecture-player/scripts/validate_contract.js
 * 版本：v1.0
 */

'use strict';

const fs = require('fs');

const VALID_STAGES = ['题目', '分析', '解答', '总结'];
const PHASE1_TOOLS = ['rough-notation'];
const PHASE1_ACTIONS = ['circle', 'underline'];
const ILLEGAL_COORD_KEYS = ['startCoord', 'coord', 'x', 'y', 'left', 'top', 'position'];
const ILLEGAL_SYNC_KEYS = ['keyword', 'keywords', 'cue', 'triggerAtWords'];

const errors = [];
const warns = [];
let info = 0;

const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

function deepScanForKeys(node, target, path, hits) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => deepScanForKeys(v, target, `${path}[${i}]`, hits));
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (target.includes(k)) hits.push({ key: k, path: `${path}.${k}` });
      deepScanForKeys(node[k], target, `${path}.${k}`, hits);
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const file = argv.find((a) => !a.startsWith('--'));

  if (!file) {
    console.error('用法: node validate_contract.js <rows.json> [--json]');
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`解析失败: ${e.message}`);
    process.exit(2);
  }

  const rows = Array.isArray(data) ? data : data.rows;
  if (!Array.isArray(rows)) {
    console.error('找不到 rows 数组');
    process.exit(2);
  }

  // ① 全局禁字段扫描（坐标 & keyword），零 keyword 是硬要求
  const coordHits = [];
  deepScanForKeys(rows, ILLEGAL_COORD_KEYS, 'rows', coordHits);
  for (const h of coordHits) err(`[坐标退场] board 不得带坐标字段：${h.path}`);

  const syncHits = [];
  deepScanForKeys(rows, ILLEGAL_SYNC_KEYS, 'rows', syncHits);
  for (const h of syncHits) err(`[零 keyword] 合同里不存在关键词字段，渲染端不得依赖：${h.path}`);

  const orderSeen = new Set();
  const questionText = [];

  rows.forEach((r, i) => {
    const at = `rows[${i}]`;
    const stage = r.stage;

    if (!VALID_STAGES.includes(stage)) err(`${at}.stage 非法值: ${JSON.stringify(stage)}`);

    // ② 真实音频是唯一时长真相源
    const hasAudio = Boolean(r.mp3 || r.audioBase64);
    if (!hasAudio) {
      err(`${at} 缺真实音频（mp3 / audioBase64）。按契约这是规格冲突，禁止用估算兜底`);
    }
    if (typeof r.duration === 'number' && hasAudio === false) {
      err(`${at} 只有 duration 没有音频：时长不得来自估算`);
    }

    // speaking rate sanity：真音频时长 vs 口播字数，偏差过大提示
    if (typeof r.duration === 'number' && hasAudio && typeof r.speech === 'string' && r.speech.length) {
      // 中文口播真人语速约 3~7 字/秒（含口癖与换气），越界说明这个 duration 多半是估出来的
      const impliedCps = r.speech.length / Math.max(r.duration, 0.1);
      if (impliedCps > 7 || impliedCps < 3) {
        warn(`${at} duration=${r.duration}s 与口播 ${r.speech.length} 字不匹配（${impliedCps.toFixed(1)} 字/秒，真人约 3~7），该 duration 大概率是猜的，渲染时须用真实音频覆盖`);
      }
    }

    if (typeof r.speech !== 'string' || !r.speech.length) err(`${at}.speech 缺失或为空`);

    if (stage === '题目') questionText.push(`${r.speech || ''} ${(r.board && r.board.content) || ''}`);

    // ③ board v3.0
    const b = r.board;
    if (!b || typeof b !== 'object') {
      err(`${at}.board 缺失`);
    } else {
      if (typeof b.startDelay !== 'number') err(`${at}.board.startDelay 必须是数字（秒）`);
      if (typeof b.content !== 'string') err(`${at}.board.content 必须是字符串（可为空串）`);
      if (b.region && !['question', 'analysis', 'solution', 'summary'].includes(b.region)) {
        err(`${at}.board.region 非法值: ${b.region}`);
      }
      if (!b.region) warn(`${at}.board.region 缺失，渲染层将按 stage 推断起始区`);
    }

    // ④ 一期动作收口
    const specs = Array.isArray(r.actionSpec) ? r.actionSpec : null;
    if (!specs) {
      err(`${at}.actionSpec 必须是数组（无动作用 []）`);
      return;
    }
    if (stage === '题目' && b && b.content !== '') {
      err(`${at} 读题行 board.content 必须为空字符串`);
    }

    specs.forEach((s, j) => {
      const sat = `${at}.actionSpec[${j}]`;
      const a = s && s.action;
      if (!a || typeof a !== 'object') {
        err(`${sat} 缺少 action 对象（order/tool 必须写在 action 内部）`);
        return;
      }
      if (typeof a.order !== 'number') {
        err(`${sat}.action.order 缺失或非数字`);
      } else {
        if (orderSeen.has(a.order)) err(`${sat}.action.order=${a.order} 重复，必须全表唯一`);
        orderSeen.add(a.order);
      }
      if (typeof a.tool !== 'string' || !PHASE1_TOOLS.includes(a.tool)) {
        err(`${sat}.action.tool=${JSON.stringify(a.tool)} 不在一期白名单 ${JSON.stringify(PHASE1_TOOLS)}（rough-line/rough-arrow 属二期）`);
      }
      if (a.tool === 'rough-notation') {
        if (!PHASE1_ACTIONS.includes(a.action)) {
          err(`${sat}.action.action=${JSON.stringify(a.action)} 不在一期白名单 ${JSON.stringify(PHASE1_ACTIONS)}`);
        }
        const t = a.target || {};
        if (!t.exactText) {
          err(`${sat} rough-notation 必须锚定 target.exactText，否则会飘`);
        } else if (typeof t.exactText === 'string') {
          const hay = questionText.join(' ');
          if (hay && !hay.includes(t.exactText)) {
            warn(`${sat} exactText="${t.exactText}" 未在题目文本中命中，检查错别字/空格`);
          }
        }
      }
      if (a.durationMs !== undefined || a.startMs !== undefined) {
        err(`${sat} 禁止携带 durationMs/startMs，时间由渲染层按音频时钟推算`);
      }
    });
  });

  // order 是否连续
  const orders = [...orderSeen].sort((x, y) => x - y);
  orders.forEach((o, i) => {
    if (o !== i + 1) warn(`order 序列不连续：期望 ${i + 1} 得到 ${o}`);
  });

  const report = [`== validate_contract ==  file=${file}  rows=${rows.length}`,
    `ERROR: ${errors.length}   WARN: ${warns.length}`];
  if (errors.length) report.push('', '-- ERROR --', ...errors.map((e) => `  ✗ ${e}`));
  if (warns.length) report.push('', '-- WARN --', ...warns.map((w) => `  ! ${w}`));
  report.push('', errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');

  const text = report.join('\n');
  if (asJson) {
    console.log(JSON.stringify({ pass: errors.length === 0, errors, warns, rows: rows.length }, null, 2));
  } else {
    console.log(text);
  }
  process.exit(errors.length ? 1 : 0);
}

main();
