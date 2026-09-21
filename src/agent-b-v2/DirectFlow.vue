<script setup>
/* @qh-core LANE=B-V2 POINT=FLOW step1<->agentB page switch */
import { ref, watch } from 'vue'
import Step1Entry from '../components/Step1Entry.vue'
import AgentBDirect from './AgentBDirect.vue'
import { message } from 'ant-design-vue'

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
  <AgentBDirect v-else :initial-handoff="handoff" @back-to-step1="backToStep1" />
</template>
