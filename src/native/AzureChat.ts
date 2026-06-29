// Azure OpenAI (Azure ChatGPT) client — mirrors the config used in the
// FullStack RAG project (gpt-5.4-mini on the OpenAI-compatible /openai/v1 surface).
// Secrets must be supplied via EXPO_PUBLIC_AZURE_OPENAI_API_KEY in a .env file.

export type ChatBackend = 'azure' | 'cloud';

export interface AzureChatResponse {
  text: string;
  latencyMs: number;
  source: ChatBackend;
}

const RAW_ENDPOINT =
  process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT ??
  'https://gcl-superapp-ai-dev.openai.azure.com/openai/v1';
const API_KEY = process.env.EXPO_PUBLIC_AZURE_OPENAI_API_KEY ?? '';
const DEPLOYMENT = process.env.EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-5.4-mini';
const API_VERSION = process.env.EXPO_PUBLIC_AZURE_OPENAI_API_VERSION ?? 'v1';

const SYSTEM_PROMPT =
  'You are a helpful assistant for a construction site diary app. Answer questions about ' +
  'site safety, progress, observations, and conditions clearly and concisely.';

export const isAzureChatAvailable = API_KEY.length > 0;
export const azureChatModelLabel = DEPLOYMENT;

interface RequestTarget {
  url: string;
  useBearer: boolean;
}

function buildRequestTarget(): RequestTarget {
  const base = RAW_ENDPOINT.replace(/\/+$/, '');

  // OpenAI-compatible v1 surface (endpoint ends with /openai/v1, Bearer auth).
  if (API_VERSION === 'v1' || base.endsWith('/openai/v1')) {
    const root = base.endsWith('/openai/v1') ? base : `${base}/openai/v1`;
    return { url: `${root}/chat/completions`, useBearer: true };
  }

  // Classic Azure REST surface (per-deployment path + api-version, api-key header).
  return {
    url: `${base}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`,
    useBearer: false,
  };
}

export async function generateAzureChatContent(prompt: string): Promise<AzureChatResponse> {
  if (!isAzureChatAvailable) {
    throw new Error(
      'Azure ChatGPT is not configured. Set EXPO_PUBLIC_AZURE_OPENAI_API_KEY in your .env file.',
    );
  }

  const start = Date.now();
  const { url, useBearer } = buildRequestTarget();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useBearer) {
    headers.Authorization = `Bearer ${API_KEY}`;
  } else {
    headers['api-key'] = API_KEY;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: DEPLOYMENT,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Azure ChatGPT request failed (${response.status}): ${errorBody.slice(0, 300)}`,
    );
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  return {
    text,
    latencyMs: Date.now() - start,
    source: 'azure',
  };
}
