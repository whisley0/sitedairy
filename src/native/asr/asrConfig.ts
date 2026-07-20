/**
 * Primary on-device ASR language for SenseVoice Small (sherpa-onnx).
 * Use `yue` for Cantonese; SenseVoice also accepts zh / en / ja / ko / auto.
 */
export const ASR_PRIMARY_LANGUAGE = 'yue';

/** Dictation engine used by EscalationDictationDock. */
export const ASR_DICTATION_ENGINE = 'sense_voice' as const;
