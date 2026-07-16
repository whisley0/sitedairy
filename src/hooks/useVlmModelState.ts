import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModelRowState } from '../components/VlmModelPicker';
import { checkGeminiNanoStatus } from '../native/GeminiNanoNative';
import {
  VLM_MODELS,
  downloadModel,
  getModelSpec,
  isModelDownloaded,
  isVlmModelId,
  type VlmModelId,
} from '../native/llm/modelManager';

const pct = (n: number) => `${Math.round(n * 100)}%`;

const PREFERENCE_ORDER: VlmModelId[] = [
  'gemini-nano',
  'smolvlm-500m',
  'smolvlm2-2.2b',
  'qwen2.5-vl-3b',
  'gemma-3-4b',
];

function preferredDownloadedId(geminiAvailable: boolean): VlmModelId {
  const order = geminiAvailable
    ? PREFERENCE_ORDER
    : PREFERENCE_ORDER.filter((id) => id !== 'gemini-nano');
  return order.find((id) => isModelDownloaded(id)) ?? 'smolvlm-500m';
}

function initialRows(geminiAvailable: boolean): Record<VlmModelId, ModelRowState> {
  const entries = VLM_MODELS.map((m) => {
    const ready =
      m.id === 'gemini-nano' ? geminiAvailable : isModelDownloaded(m.id);
    return [m.id, { ready, downloading: false, progress: '' }] as const;
  });
  return Object.fromEntries(entries) as Record<VlmModelId, ModelRowState>;
}

function defaultSelectedId(preferred: string | undefined, geminiAvailable: boolean): VlmModelId {
  const preferredId = isVlmModelId(preferred) ? preferred : undefined;
  if (preferredId === 'gemini-nano' && !geminiAvailable) {
    return preferredDownloadedId(false);
  }
  if (preferredId && (preferredId === 'gemini-nano' ? geminiAvailable : isModelDownloaded(preferredId))) {
    return preferredId;
  }
  return preferredDownloadedId(geminiAvailable);
}

export function useVlmModelState(preferredModelId?: string) {
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [geminiChecked, setGeminiChecked] = useState(false);
  const [rows, setRows] = useState<Record<VlmModelId, ModelRowState>>(() => initialRows(false));
  const [selectedId, setSelectedId] = useState<VlmModelId>('smolvlm-500m');

  useEffect(() => {
    let cancelled = false;
    void checkGeminiNanoStatus().then((status) => {
      if (cancelled) return;
      const available = status.available;
      setGeminiAvailable(available);
      setRows(initialRows(available));
      setSelectedId((prev) => {
        if (prev === 'gemini-nano' && !available) {
          return preferredDownloadedId(false);
        }
        return defaultSelectedId(preferredModelId, available);
      });
      setGeminiChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [preferredModelId]);

  const visibleModels = useMemo(
    () => VLM_MODELS.filter((m) => m.id !== 'gemini-nano' || geminiAvailable),
    [geminiAvailable],
  );

  const recommendedId: VlmModelId = geminiAvailable ? 'gemini-nano' : 'smolvlm-500m';

  const setRow = useCallback((id: VlmModelId, patch: Partial<ModelRowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const handleDownload = useCallback(
    async (id: VlmModelId) => {
      setRow(id, { downloading: true, progress: 'Starting…' });
      try {
        await downloadModel(id, (info) => {
          const frac = info.fileFraction >= 0 ? ` ${pct(info.fileFraction)}` : '';
          setRow(id, { progress: `File ${info.index}/${info.total}${frac}` });
        });
        setRow(id, { ready: true, downloading: false, progress: '' });
        setSelectedId(id);
      } catch {
        setRow(id, { downloading: false, progress: '' });
        throw new Error('Download failed');
      }
    },
    [setRow],
  );

  const selectModel = useCallback((id: VlmModelId) => {
    if (isVlmModelId(id)) setSelectedId(id);
  }, []);

  const syncReadyFromDisk = useCallback(() => {
    setRows((prev) => {
      const next = { ...prev };
      for (const m of VLM_MODELS) {
        const row = next[m.id];
        if (row?.downloading) continue;
        const ready =
          m.id === 'gemini-nano' ? geminiAvailable : isModelDownloaded(m.id);
        next[m.id] = {
          ready,
          downloading: false,
          progress: '',
        };
      }
      return next;
    });
  }, [geminiAvailable]);

  useEffect(() => {
    if (geminiChecked) {
      syncReadyFromDisk();
    }
  }, [geminiChecked, syncReadyFromDisk]);

  const selectedSpec = isVlmModelId(selectedId) ? getModelSpec(selectedId) : getModelSpec('smolvlm-500m');
  const selectedRow = rows[selectedId];
  const anyDownloading = Object.values(rows).some((r) => r.downloading);
  const selectedReady = selectedRow?.ready ?? false;
  const selectedDownloading = selectedRow?.downloading ?? false;
  const anyReady = visibleModels.some((m) => rows[m.id]?.ready);

  return {
    rows,
    selectedId,
    selectedSpec,
    visibleModels,
    recommendedId,
    geminiAvailable,
    geminiChecked,
    selectModel,
    handleDownload,
    syncReadyFromDisk,
    anyDownloading,
    selectedReady,
    selectedDownloading,
    anyReady,
  };
}
