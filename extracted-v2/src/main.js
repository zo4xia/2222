import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
// @legacy L3-M03 ✅ 已治理 · boardTypography.css 已删除（字体族无消费者）
import App from './App.vue'

createApp(App).use(Antd).mount('#app')
