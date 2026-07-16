import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { VLM_PHOTO_MAX_WIDTH } from '../native/llm/vlmPerformance';

const PHOTO_DIR = `${FileSystem.documentDirectory}risk-queue/photos/`;

let persistChain: Promise<void> = Promise.resolve();

export function canonicalRiskPhotoUri(itemId: string): string {
  return `${PHOTO_DIR}${itemId}.jpg`;
}

function withFileScheme(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  if (/^[A-Za-z]:\\/.test(uri) || uri.startsWith('/')) {
    return `file://${uri.replace(/\\/g, '/')}`;
  }
  return uri;
}

function uriCandidates(uri: string): string[] {
  if (!uri) return [];
  const out = new Set<string>();
  const base = uri.split(/[?#]/)[0];
  const decoded = decodeURIComponent(base);
  [uri, base, decoded].forEach((u) => {
    if (!u) return;
    out.add(u);
    out.add(withFileScheme(u));
  });
  return [...out];
}

async function firstExistingUri(...uris: Array<string | undefined>): Promise<string | undefined> {
  for (const uri of uris) {
    if (!uri) continue;
    for (const candidate of uriCandidates(uri)) {
      try {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info.exists) {
          return candidate;
        }
      } catch {
        // Ignore invalid URI variants and keep trying.
      }
    }
  }
  return undefined;
}

/** Absolute file URI for native VLM / Gemini modules (llama.rn expects file://). */
export function toNativeFileUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) return trimmed;
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file://${normalized}`;
}

/** Resolve a queued photo to a durable path, then normalize for native inference. */
export async function resolvePhotoForVlm(itemId: string, storedUri?: string): Promise<string> {
  const resolved = await resolveRiskPhotoUri(itemId, storedUri);
  if (resolved.missing) {
    throw new Error('Photo file is no longer on this device.');
  }
  return toNativeFileUri(resolved.uri);
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    return Boolean(await firstExistingUri(uri));
  } catch {
    return false;
  }
}

/** Resolve a queued photo to its durable path, migrating legacy temp URIs when possible. */
export async function resolveRiskPhotoUri(
  itemId: string,
  storedUri?: string,
): Promise<{ uri: string; missing: false } | { missing: true }> {
  const canonical = canonicalRiskPhotoUri(itemId);

  const canonicalExisting = await firstExistingUri(canonical);
  if (canonicalExisting) {
    return { uri: canonicalExisting, missing: false };
  }

  const storedExisting = storedUri ? await firstExistingUri(storedUri) : undefined;
  if (storedExisting && storedExisting !== canonical) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    await FileSystem.copyAsync({ from: storedExisting, to: canonical });
    if (await fileExists(canonical)) {
      return { uri: canonical, missing: false };
    }
  }

  return { missing: true };
}

/** Copy and downscale so queueing photos does not spike RAM while a VLM job runs. */
export async function persistRiskPhoto(sourceUri: string, itemId: string): Promise<string> {
  let resultUri = '';
  const job = async () => {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });

    const destUri = canonicalRiskPhotoUri(itemId);

    const resized = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: VLM_PHOTO_MAX_WIDTH } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    await FileSystem.deleteAsync(destUri, { idempotent: true });
    await FileSystem.copyAsync({ from: resized.uri, to: destUri });

    const info = await FileSystem.getInfoAsync(destUri);
    if (!info.exists) {
      throw new Error('Failed to save queued photo.');
    }

    resultUri = destUri;
  };

  persistChain = persistChain.then(job, job);
  await persistChain;
  return resultUri;
}

/** Remove persisted queue photo files for an item. */
export async function deleteRiskPhoto(itemId: string, storedUri?: string): Promise<void> {
  const canonical = canonicalRiskPhotoUri(itemId);
  await FileSystem.deleteAsync(canonical, { idempotent: true });
  if (storedUri && storedUri !== canonical) {
    await FileSystem.deleteAsync(storedUri, { idempotent: true });
  }
}
