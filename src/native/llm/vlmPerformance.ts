/** Shared knobs for faster on-device VLM inference. */
import { Platform } from 'react-native';

/** Context window — image tokens + short JSON only. */
export const VLM_N_CTX = 2048;

/** Offload transformer layers to GPU when OpenCL/Metal is available. */
export const VLM_GPU_LAYERS = 99;

/** Lower vision token budget = faster image encode, slightly less detail. */
export const VLM_IMAGE_MAX_TOKENS = 192;
export const VLM_IMAGE_MIN_TOKENS = 64;

/** Short JSON assessment; lower = faster decode. */
export const VLM_MAX_PREDICT_TOKENS = 96;

/** Queue photos are downscaled before persistence to speed vision encoding. */
export const VLM_PHOTO_MAX_WIDTH = 384;

/** Memory-map GGUF weights instead of loading fully into RAM. */
export const VLM_USE_MMAP = true;

export type VlmRuntimeProfile = 'gpu' | 'cpu';

/** CPU thread budget for llama.cpp (Tensor/Pixel-class devices benefit from >4). */
export function vlmInferThreads(): number {
  return Platform.OS === 'android' ? 6 : 4;
}

export function defaultVlmProfile(): VlmRuntimeProfile {
  // Pixel/Tensor and most Android devices lack Adreno OpenCL; skip a GPU probe that
  // can leave llama.rn in a bad state before the next (re-)assessment.
  return Platform.OS === 'android' ? 'cpu' : 'gpu';
}

export function llamaInitParams(profile: VlmRuntimeProfile) {
  const threads = vlmInferThreads();
  const shared = {
    n_ctx: VLM_N_CTX,
    ctx_shift: false as const,
    use_mmap: VLM_USE_MMAP,
    n_threads: threads,
  };

  if (profile === 'gpu') {
    return {
      ...shared,
      n_gpu_layers: VLM_GPU_LAYERS,
      flash_attn_type: 'auto' as const,
    };
  }

  return {
    ...shared,
    n_gpu_layers: 0,
    n_batch: 256,
    flash_attn_type: 'off' as const,
  };
}

export function multimodalInitParams(profile: VlmRuntimeProfile) {
  return {
    use_gpu: profile === 'gpu',
    image_max_tokens: VLM_IMAGE_MAX_TOKENS,
    image_min_tokens: VLM_IMAGE_MIN_TOKENS,
  };
}
