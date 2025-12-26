
// A lightweight client to replace the SDK for our specific Proxy Architecture
// This ensures we can pass the X-Gemini-Key header correctly.

const PROXY_BASE = '/api';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: any;
  apiKey: string;
}

export async function proxyFetch(endpoint: string, options: RequestOptions) {
  const { method = 'POST', body, apiKey } = options;

  const res = await fetch(`${PROXY_BASE}/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Gemini-Key': apiKey, // Security: Key in header, not URL
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
