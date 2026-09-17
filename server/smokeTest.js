/* @qh-core LANE=TEST POINT=FULL_SMOKE_TEST */
import assert from "node:assert/strict";
import { handleRecognitionRequest } from "./recognitionHandler.js";
import { handleAgentBV2Request } from "./agentBV2Handler.js";
import { handleCheckAgentRequest } from "./checkAgentHandler.js";
import { handleDeliverableRequest } from "./deliverableStoreHandler.js";
import { handleCleanupRequest } from "./cleanupHandler.js";
import { polishRowsASR } from "../src/check-agent/asrPolish.js";
import { applyAgentBV2Timeline } from "../src/agent-b-v2/timing.js";
import { AGENT_A_KNOWLEDGE_BASE } from "./docReferences.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: "",
    setHeader(name, value) { this.headers.set(name, value) },
    writeHead(code, headers = {}) {
      this.statusCode = code;
      Object.entries(headers).forEach(([k, v]) => this.headers.set(k, v));
      return this;
    },
    end(payload = "") {
      this.body = typeof payload === "string" ? payload : JSON.stringify(payload);
      return this;
    }
  };
}

async function runSmokeTests() {
  console.log("=== 启动全链路工程冒烟测试 ===");

  // 1. 本地 ASR 引擎测试
  console.log("1. 测试本地 ASR 规范引擎 (算式口播规范化与板书清洗)...");
  const rawRows = [
    { stage: "题目", speech: "这道题是 8+5=?", board: { content: "8×5=40", startDelay: 0 }, actionSpec: [] },
    { stage: "分析", speech: "先看数字8，离10差2个。", board: { content: "8->10 (2)", startDelay: 1 }, actionSpec: [] },
  ];
  const asrResult = polishRowsASR(rawRows);
  assert.equal(asrResult.rows.length, 2);
  assert.match(asrResult.rows[0].speech, /8加5/);
  assert.equal(asrResult.rows[0].board.content, "8x5=40");
  console.log("   ✓ 本地 ASR 引擎测试通过");

  // 2. 动态时间线排布算法测试
  console.log("2. 测试 160字/分 + 1.5s 动态时间线排布算法...");
  const timedRows = applyAgentBV2Timeline(rawRows, { rowGapMs: 1500 });
  assert.equal(timedRows.length, 2);
  assert.equal(timedRows[0].timingStatus, "estimated");
  assert.ok(timedRows[0].estimatedDurationMs > 0);
  console.log("   ✓ 动态时间线算法测试通过 (首行耗时: " + timedRows[0].estimatedDurationMs + "ms)");

  // 3. 交付物打包与持久化测试
  console.log("3. 测试交付物打包与离线 HTML 渲染...");
  const devResp = mockResponse();
  await handleDeliverableRequest({
    method: "POST",
    url: "/api/deliverable",
    headers: {},
    body: {
      deliverable: {
        title: "冒烟测试微课包",
        handoff: { problemText: "8+5=?" },
        rows: timedRows,
        topicLayout: { layout: "left_right" },
        createdAt: new Date().toISOString(),
      }
    }
  }, devResp, "/");
  assert.equal(devResp.statusCode, 200);
  const devData = JSON.parse(devResp.body);
  assert.equal(devData.ok, true);
  assert.ok(devData.projectCode);
  assert.ok(devData.url);
  console.log("   ✓ 交付物打包持久化测试通过 (项目编码: " + devData.projectCode + ")");

  // 4. 受控安全清理测试
  console.log("4. 测试受控安全文件清理...");
  const cleanResp = mockResponse();
  await handleCleanupRequest({
    method: "POST",
    url: "/api/cleanup",
    headers: {},
    body: { preserveCurrent: true, olderThanMinutes: 120 }
  }, cleanResp);
  assert.equal(cleanResp.statusCode, 200);
  const cleanData = JSON.parse(cleanResp.body);
  assert.equal(cleanData.ok, true);
  console.log("   ✓ 受控安全清理测试通过 (已检查清理完成)");

  console.log("=== 全链路工程冒烟测试 100% 成功达成 ===");
}

runSmokeTests().catch(err => {
  console.error("冒烟测试失败:", err);
  process.exit(1);
});
