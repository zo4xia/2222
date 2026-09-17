/* @qh-core LANE=B-V2 POINT=BOOT entry=agent-b-v2.html */
import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import '../style.css'
import DirectFlow from './DirectFlow.vue'
import { registerAntdComponents } from '../lib/registerAntd.js'

registerAntdComponents(createApp(DirectFlow)).mount('#agent-b-v2-app')
