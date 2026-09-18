<script setup>
/**
 * @qh-core LANE=MICRO_AGENT POINT=CHAT_PANEL 小 agent 对话微调面板
 *
 * 三种角色：
 * 1. 动作微调（actionSpec 调整）
 * 2. 板书微调（board 字号/内容/坐标）
 * 3. 口播微调（speech 重写）
 *
 * 用户在 player 页面对话：「第2行的字写大一点」→ 小 agent 解析 → 返回 patch → 应用
 */
import { ref, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons-vue'
import { refineWithMicroAgent, applyPatch } from '../micro-agent/service.js'

const props = defineProps({
  deliverable: { type: Object, default: null },
})

const emit = defineEmits(['apply-patch', 'update:deliverable'])

const chatLog = ref([
  {
    role: 'agent',
    content: '你好！我是小 agent，可以帮你微调板书动作、字号、口播稿等。直接说就行，比如"第2行的字写大一点"。',
  },
])
const chatInput = ref('')
const sending = ref(false)
const logRef = ref(null)

async function handleSend() {
  const text = chatInput.value.trim()
  if (!text || sending.value) return

  // push 用户消息
  chatLog.value.push({ role: 'user', content: text })
  chatInput.value = ''
  sending.value = true
  await nextTick()
  scrollLogToBottom()

  // push 思考中
  chatLog.value.push({ role: 'agent', content: '正在分析意图...', thinking: true })
  await nextTick()
  scrollLogToBottom()

  try {
    const res = await refineWithMicroAgent(text, props.deliverable)
    // 移除 thinking
    chatLog.value = chatLog.value.filter(m => !m.thinking)

    if (!res.ok) {
      chatLog.value.push({ role: 'agent', content: `⚠️ ${res.error || '请求失败'}` })
    } else {
      chatLog.value.push({
        role: 'agent',
        content: res.reply || '已处理',
        intent: res.intent,
        applied: res.applied,
      })

      // 应用 patch 到 deliverable
      if (res.patch && res.patch.changes && typeof res.patch.rowIndex === 'number') {
        const newDeliverable = applyPatch(props.deliverable, res.patch)
        emit('update:deliverable', newDeliverable)
        emit('apply-patch', res.patch)
      }
    }
  } catch (err) {
    chatLog.value = chatLog.value.filter(m => !m.thinking)
    chatLog.value.push({ role: 'agent', content: `⚠️ ${err.message || '网络异常'}` })
  } finally {
    sending.value = false
    await nextTick()
    scrollLogToBottom()
  }
}

function scrollLogToBottom() {
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const INTENT_LABELS = {
  action_tune: '动作',
  board_tune: '板书',
  speech_tune: '口播',
  unknown: '未识别',
}
</script>

<template>
  <div class="micro-agent-chat">
    <div class="chat-header">
      <h3>
        <robot-outlined />
        小 agent 对话微调
      </h3>
      <div class="chat-badges">
        <span class="badge">动作</span>
        <span class="badge">板书</span>
        <span class="badge">口播</span>
      </div>
    </div>
    <div class="chat-log" ref="logRef">
      <div
        v-for="(msg, idx) in chatLog"
        :key="idx"
        :class="['chat-msg', `chat-msg--${msg.role}`]"
      >
        <div class="chat-msg__avatar">
          <user-outlined v-if="msg.role === 'user'" />
          <robot-outlined v-else />
        </div>
        <div class="chat-msg__body">
          <div class="chat-msg__content">
            {{ msg.content }}
            <span v-if="msg.thinking" class="thinking-dots">
              <span></span><span></span><span></span>
            </span>
          </div>
          <div v-if="msg.intent || msg.applied?.length" class="chat-msg__meta">
            <span v-if="msg.intent" class="intent-tag">
              {{ INTENT_LABELS[msg.intent] || msg.intent }}
            </span>
            <span v-if="msg.applied?.length" class="applied-list">
              已应用：{{ msg.applied.join('、') }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="chat-input">
      <a-textarea
        v-model:value="chatInput"
        :auto-size="{ minRows: 1, maxRows: 4 }"
        placeholder="例如：第2行字写大一点 / 把箭头改成红色 / 第3行口播再讲细一点"
        :disabled="sending"
        @keydown="handleKeydown"
      />
      <a-button
        type="primary"
        :loading="sending"
        :disabled="!chatInput.trim()"
        @click="handleSend"
      >
        <template #icon><send-outlined /></template>
        发送
      </a-button>
    </div>
  </div>
</template>

<script>
// 仅导出组件元信息（脚本逻辑在 script setup 中）
export default {
  name: 'MicroAgentChat',
}
</script>

<style scoped>
.micro-agent-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
}
.chat-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.chat-header h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: #1f1f1f;
}
.chat-badges {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #f0f0ff;
  color: #5450dc;
  border-radius: 10px;
}
.chat-log {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chat-msg {
  display: flex;
  gap: 8px;
}
.chat-msg__avatar {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 14px;
}
.chat-msg--user .chat-msg__avatar {
  background: #5450dc;
  color: #fff;
}
.chat-msg__body {
  flex: 1;
  min-width: 0;
}
.chat-msg__content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  word-break: break-word;
}
.chat-msg--user .chat-msg__content {
  color: #5450dc;
  font-weight: 500;
}
.chat-msg__meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  font-size: 11px;
}
.intent-tag {
  padding: 1px 6px;
  background: #f0f0ff;
  color: #5450dc;
  border-radius: 3px;
}
.applied-list {
  color: #888;
}
.thinking-dots {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
}
.thinking-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #999;
  animation: thinking-bounce 1.4s infinite ease-in-out both;
}
.thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
.thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes thinking-bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
.chat-input {
  padding: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.chat-input :deep(.ant-btn) {
  flex: 0 0 auto;
}
</style>
