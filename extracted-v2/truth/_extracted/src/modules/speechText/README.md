# Speech Text

Local text preparation before TTS.

- Keeps Agent output out of the final timing contract.
- Removes or preserves sync-marker content upstream.
- Converts display math into provider-ready speech text before Aliyun CosyVoice.
- Keeps display formulas on `TtsSentenceUnit.text`; only `speechText` is normalized for TTS.
- This layer is the speech ingress filter. Future industry terms and special nouns should be normalized here before entering a provider.
