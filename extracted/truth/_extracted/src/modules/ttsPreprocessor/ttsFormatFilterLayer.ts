// @cleanroom-module: tts-format-filter-layer
// @domain: tts-audio-pipeline
// @boundary: 静默异步中间格式过滤层，用户不可见
// 作用：在用户确认板书内容后，静默异步处理阿里云TTS格式，前端显示干净内容

import type { ScriptAgentDraft } from '../../domain/teachingProject';
import { prepareAliyunMathSpeechText } from '../speechText/aliyunMathSpeechText';
import { splitScriptIntoTtsSentenceUnits } from '../timeline-factory/splitScriptIntoTtsSentenceUnits';

export type TtsFormatFilterResult = {
  // 用户前端显示的干净内容
  displayContent: {
    scriptText: string;
    boardText: string;
  };
  // 发送给阿里云TTS的处理后内容
  ttsContent: {
    speechText: string;
    units: Array<{
      id: string;
      speechText: string;
      boardMarkerText?: string;
      chainKey?: string;
    }>;
  };
};

/**
 * 中间格式过滤层 - 用户不可见
 * 将用户确认的板书内容分离为：
 * 1. 前端显示的干净内容
 * 2. 发送给阿里云TTS的特殊处理格式
 */
export async function createTtsFormatFilterLayer(
  draft: ScriptAgentDraft
): Promise<TtsFormatFilterResult> {
  // 异步分批处理，避免阻塞用户界面
  return new Promise((resolve) => {
    // 使用 setTimeout 确保异步执行
    setTimeout(() => {
      try {
        // 1. 生成前端显示的干净内容
        const displayContent = createDisplayContent(draft);

        // 2. 生成发送给阿里云TTS的处理后内容
        const ttsContent = createTtsContent(draft);

        resolve({
          displayContent,
          ttsContent,
        });
      } catch (error) {
        console.error('TTS格式过滤层处理失败:', error);
        // 失败时返回原始内容，确保前端不显示乱码
        resolve({
          displayContent: {
            scriptText: draft.spokenScript || '',
            boardText: draft.boardPlan || '',
          },
          ttsContent: {
            speechText: draft.spokenScript || '',
            units: [],
          },
        });
      }
    }, 0);
  });
}

/**
 * 创建前端显示的干净内容
 * 确保用户看到的是正常的板书内容，没有LaTeX代码或处理标记
 */
function createDisplayContent(draft: ScriptAgentDraft) {
  // 从rows生成干净的显示文本，安全处理可能为undefined的情况
  const rows = draft.rows || [];

  const cleanScriptText = rows
    .map(row => row.voiceText || '')
    .filter(Boolean)
    .join('\n');

  const cleanBoardText = rows
    .map(row => row.boardSlice || '')
    .filter(Boolean)
    .join('\n');

  return {
    scriptText: cleanScriptText,
    boardText: cleanBoardText,
  };
}

/**
 * 创建发送给阿里云TTS的处理后内容
 * 包含数学公式包裹、语音转换等特殊处理
 */
function createTtsContent(draft: ScriptAgentDraft) {
  // 安全处理可能为undefined的rows
  const rows = draft.rows || [];

  // 生成完整的脚本文本
  const fullScriptText = rows
    .map(row => row.voiceText || '')
    .filter(Boolean)
    .join('\n');

  // 使用现有的TTS分割和预处理逻辑，安全处理chainKeys
  const chainKeys: string[] = rows
    .map(row => row.chainKey)
    .filter((key): key is string => Boolean(key));

  const splitResult = splitScriptIntoTtsSentenceUnits(fullScriptText, {
    chainKeys,
  });

  return {
    speechText: splitResult.plainTtsText,
    units: splitResult.units.map(unit => ({
      id: unit.id,
      speechText: unit.speechText,
      boardMarkerText: unit.boardMarkerText,
      chainKey: unit.chainKey,
    })),
  };
}

/**
 * 静默异步批量处理多个板书内容
 * 用于处理大量数据时的分批处理
 */
export async function batchProcessTtsFormatFilter(
  drafts: ScriptAgentDraft[]
): Promise<TtsFormatFilterResult[]> {
  const batchSize = 3; // 每批处理3个，避免阻塞
  const results: TtsFormatFilterResult[] = [];

  for (let i = 0; i < drafts.length; i += batchSize) {
    const batch = drafts.slice(i, i + batchSize);
    const batchPromises = batch.map(draft => createTtsFormatFilterLayer(draft));

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      console.error(`批量处理第${Math.floor(i / batchSize) + 1}批失败:`, error);
      // 继续处理下一批
    }

    // 在批次之间添加小延迟，避免阻塞UI
    if (i + batchSize < drafts.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return results;
}
