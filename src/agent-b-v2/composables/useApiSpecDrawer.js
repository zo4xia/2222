/**
 * useApiSpecDrawer.js — 下游 Agent API 规范抽屉的开关 + 加载 + 复制提示词
 *
 * ponytail: 从 AgentBDirect.vue 1273-1313 行抽出（~40 行），含:
 *   - apiSpecDrawerOpen / apiSpecMarkdown / loadingApiSpec 3 个 ref
 *   - openApiSpecDrawer (fetch /api/deliverable/api-spec → 降级 /deliverable/DELIVERABLE_API_SPEC.md → 兜底字符串)
 *   - copyApiSpecPrompt (复制下游 Agent 消费指南到剪贴板)
 *
 * 调用方需传 message.success / message.info（ant-design-vue 静态方法）避免组件耦合。
 *
 * @qh-core LANE=COMPOSABLE POINT=USE_API_SPEC_DRAWER
 */
import { ref } from 'vue'

export function useApiSpecDrawer({ message }) {
  const apiSpecDrawerOpen = ref(false)
  const apiSpecMarkdown = ref('')
  const loadingApiSpec = ref(false)

  async function openApiSpecDrawer() {
    apiSpecDrawerOpen.value = true
    if (!apiSpecMarkdown.value) {
      loadingApiSpec.value = true
      try {
        const res = await fetch('/api/deliverable/api-spec')
        const data = await res.json()
        if (data?.ok && data?.markdown) {
          apiSpecMarkdown.value = data.markdown
        } else {
          const docRes = await fetch('/deliverable/DELIVERABLE_API_SPEC.md')
          apiSpecMarkdown.value = await docRes.text()
        }
      } catch {
        apiSpecMarkdown.value = '# 教学课件与音画微课交付物 API 规范 (v2.0)\n\n每个 row 为一组原子单元；语音全程；板书与动作二者绝对互斥；动作时长定量 1~2 秒作为标点停顿。供下游课件与画布 Agent 消费。'
      } finally {
        loadingApiSpec.value = false
      }
    }
  }

  function copyApiSpecPrompt() {
    const promptText = `【下游 Agent 消费指南】：
你是一名负责将教学交付物 JSON 制作成课件 PPT / 画布动画的下游 Agent。
核心消费规则：
1. 每个 row 是一组独立的原子播放单元。
2. speech 语音贯穿全程。
3. 板书（board）与动作（actionSpec）在时间上绝对互斥（同一时刻单手操作，不得重叠）。
4. 动作时长严格定量在 1~2 秒内，作为口播句子中的标点停顿。
5. 请直接消费每个 row 中的 exclusiveExecutionPlan 数组，按 startOffsetMs 依次触发。
完整接口规范详见系统内置文档 /deliverable/DELIVERABLE_API_SPEC.md。`

    navigator.clipboard.writeText(promptText).then(() => {
      message.success('已复制下游 Agent 消费提示词！')
    }).catch(() => {
      message.info('请手动复制提示词')
    })
  }

  return { apiSpecDrawerOpen, apiSpecMarkdown, loadingApiSpec, openApiSpecDrawer, copyApiSpecPrompt }
}
