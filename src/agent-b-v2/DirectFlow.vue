<script setup>
/* @qh-core LANE=B-V2 POINT=FLOW step1<->agentB page switch */
import { defineAsyncComponent, h, ref, watch } from 'vue'
import Step1Entry from '../components/Step1Entry.vue'
import { message } from 'ant-design-vue'

// 异步组件加载失败兜底（2026-09-17）：自动重试 1 次，再失败渲染可点重试的错误卡，杜绝白屏卡死
const agentBKey = ref(0)
function retryAgentB() {
  agentBKey.value += 1
}
const AgentBLoadError = {
  setup() {
    return () =>
      h('div', { style: 'padding:32px;text-align:center;font-family:inherit' }, [
        h('h3', { style: 'margin:0 0 8px' }, 'Agent B 工作室加载失败'),
        h(
          'p',
          { style: 'color:#8a8f9a;margin:0 0 16px' },
          '常见原因是浏览器缓存异常（ERR_CACHE_READ_FAILURE）。可点下方重试，或按 Ctrl+Shift+R 硬刷。'
        ),
        h(
          'button',
          {
            onClick: retryAgentB,
            style:
              'padding:8px 20px;border:none;border-radius:6px;background:#1677ff;color:#fff;cursor:pointer;font-size:14px',
          },
          '重试'
        ),
      ])
  },
}
const AgentBDirect = defineAsyncComponent({
  loader: () => import('./AgentBDirect.vue'),
  errorComponent: AgentBLoadError,
  delay: 0,
  onError(error, retry, fail, attempts) {
    console.error('[DirectFlow] AgentBDirect 动态加载失败', error)
    if (attempts <= 2) retry()
    else fail()
  },
})

const page = ref('step1')
const handoff = ref(null)

watch(page, (value) => {
  document.title = value === 'agent-b' ? '生成 · Agent B 五字段' : '教学板书 · 第1步 贴题识别'
}, { immediate: true })

async function enterAgentB() {
  // 只从实体文件读 —— 文件是唯一真相来源
  try {
    const res = await fetch('/api/handoff')
    const data = await res.json()
    if (data.ok && data.handoff) {
      handoff.value = data.handoff
      page.value = 'agent-b'
    } else {
      message.error('未找到 handoff 存档，请先在第 1 步确认题目')
    }
  } catch (e) {
    message.error(`读取存档失败：${e?.message || String(e)}`)
  }
}

function backToStep1() {
  page.value = 'step1'
}
</script>

<template>
  <Step1Entry v-if="page === 'step1'" @enter-board-draft="enterAgentB" />
  <AgentBDirect v-else :key="`agentb-${agentBKey}`" :initial-handoff="handoff" @back-to-step1="backToStep1" />
</template>
