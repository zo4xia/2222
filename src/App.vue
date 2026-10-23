<script setup>
/* @qh-core LANE=CLEAN POINT=APP_SHELL route step1 into direct single-agent step2 */
/* ★ 商品化 P4（70-d 巡逻实锤）：全中文产品里 Ant Design 弹窗按钮是英文 Cancel/OK（全库无 locale
   配置）——根组件包 ConfigProvider 挂 zh_CN，配置面板每次必撞的尴尬归零。 */
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import DirectFlow from './agent-b-v2/DirectFlow.vue'
import GlobalPulseLoading from './components/GlobalPulseLoading.vue'
</script>

<template>
  <a-config-provider :locale="zhCN">
    <DirectFlow />
    <GlobalPulseLoading />
  </a-config-provider>
</template>
