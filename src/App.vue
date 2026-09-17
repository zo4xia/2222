<script setup>
/* @qh-core LANE=CLEAN POINT=APP_SHELL route step1 into direct single-agent step2 */
import DirectFlow from './agent-b-v2/DirectFlow.vue'
import GlobalPulseLoading from './components/GlobalPulseLoading.vue'
</script>

<template>
  <DirectFlow />
  <GlobalPulseLoading />
</template>
