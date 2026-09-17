import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import '../style.css'
import BoardPreviewApp from './BoardPreviewApp.vue'

createApp(BoardPreviewApp).use(Antd).mount('#app')
