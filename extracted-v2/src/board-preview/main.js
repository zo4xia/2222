import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import '../style.css'
// @legacy L3-M03 ✅ 已治理 · boardTypography.css 已删除
import BoardPreviewApp from './BoardPreviewApp.vue'

createApp(BoardPreviewApp).use(Antd).mount('#app')
