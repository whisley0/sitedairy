import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { firebaseApp } from '../config/firebase';

// gemini-2.5-flash is NOT available in asia-east2 (HK) for this project.
// Singapore and us-central1 work (verified against firebasevertexai API).
const VERTEX_ATTEMPTS = [
  { location: 'asia-southeast1', model: 'gemini-2.5-flash' },
  { location: 'us-central1', model: 'gemini-2.5-flash' },
  { location: 'asia-southeast1', model: 'gemini-2.5-flash-lite' },
] as const;

const PRIMARY = VERTEX_ATTEMPTS[0];

let activeConfig: (typeof VERTEX_ATTEMPTS)[number] | null = null;
let generativeModel: ReturnType<typeof getGenerativeModel> | null = null;

function getCloudModel(config: (typeof VERTEX_ATTEMPTS)[number]) {
  if (
    activeConfig?.location !== config.location ||
    activeConfig?.model !== config.model ||
    !generativeModel
  ) {
    const ai = getAI(firebaseApp, { backend: new VertexAIBackend(config.location) });
    generativeModel = getGenerativeModel(ai, { model: config.model });
    activeConfig = config;
  }
  return generativeModel;
}

/** Cloud Gemini uses Firebase AI Logic + Vertex AI (Singapore region). */
export const isCloudGeminiAvailable = true;

export const cloudGeminiRegionLabel = `${PRIMARY.model} @ ${PRIMARY.location}`;

function isRetryableError(message: string): boolean {
  return (
    message.includes('not found') ||
    message.includes('does not have access') ||
    message.includes('PERMISSION_DENIED')
  );
}

export async function generateCloudGeminiContent(prompt: string) {
  const start = Date.now();
  let lastError = 'Cloud Gemini request failed.';

  for (const config of VERTEX_ATTEMPTS) {
    try {
      const result = await getCloudModel(config).generateContent(prompt);
      const text = result.response.text();

      return {
        text,
        latencyMs: Date.now() - start,
        source: 'cloud' as const,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;

      if (!isRetryableError(lastError)) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(
    `Cloud Gemini failed after trying Singapore and US regions. Last error: ${lastError}`,
  );
}
