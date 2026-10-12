import { createApp } from 'vue'
import Antd, { message } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import './board-tools/boardTypography.css'
import App from './App.vue'
import { initBiuBubbleListener } from './utils/biuBubble'

message.config({
  top: '72px',
  duration: 2.5,
  maxCount: 3,
})

initBiuBubbleListener()

createApp(App).use(Antd).mount('#app')
