// @cleanroom-module: activeVoiceAudioElement
// @domain: voice-audio-playback
// @io-input: current A-track HTMLAudioElement
// @io-output: readonly current audio element for first-draft canvas recording
// @boundary: transient runtime pointer only; does not mutate A/B/C data or project storage

let activeVoiceAudioElement: HTMLAudioElement | null = null;

export function setActiveVoiceAudioElement(audio: HTMLAudioElement | null) {
  activeVoiceAudioElement = audio;
}

export function getActiveVoiceAudioElement() {
  return activeVoiceAudioElement;
}
