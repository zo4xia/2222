/**
 * @qh-core LANE=PLAYER POINT=MAIN_ENTRY player 页面入口
 *
 * 独立入口，挂载 PlayerPage 组件
 * 支持 URL 参数 ?id=<deliverableCode> 自动加载
 */
import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import PlayerPage from './components/PlayerPage.vue'

// 从 URL 读取 deliverable id
const urlParams = new URLSearchParams(window.location.search)
const deliverableId = urlParams.get('id') || ''

createApp(PlayerPage, {
  deliverableId,
  showBack: true,
}).use(Antd).mount('#app')
