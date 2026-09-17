export function readUserFacingSegmentLabel(chainKey: string | undefined, fallbackIndex: number): string {
  if (chainKey === 'template-open' || chainKey?.startsWith('template-open-')) {
    return '开场';
  }
  if (chainKey === 'template-pre' || chainKey?.startsWith('template-pre-')) {
    return '分析';
  }
  if (chainKey === 'template-end' || chainKey?.startsWith('template-end-')) {
    return '总结';
  }

  const stepMatch = chainKey?.match(/^step-(\d+)$/);
  if (stepMatch) {
    return `步骤${stepMatch[1]}`;
  }

  return `片段${fallbackIndex + 1}`;
}

export function readUserFacingSegmentLabelFromChainKey(chainKey: string | undefined): string {
  if (chainKey === 'template-open' || chainKey?.startsWith('template-open-')) {
    return '开场';
  }
  if (chainKey === 'template-pre' || chainKey?.startsWith('template-pre-')) {
    return '分析';
  }
  if (chainKey === 'template-end' || chainKey?.startsWith('template-end-')) {
    return '总结';
  }

  const stepMatch = chainKey?.match(/^step-(\d+)$/);
  if (stepMatch) {
    return `步骤${stepMatch[1]}`;
  }

  return '片段';
}
