
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Key",
        },
      });
    }

    // Only allow specific paths if needed, e.g., /v1beta/models/...
    // Construct target URL
    const targetUrl = new URL(url.pathname + url.search, "https://generativelanguage.googleapis.com");

    const clientKey = request.headers.get("X-Gemini-Key");
    if (!clientKey) {
      return new Response(JSON.stringify({ error: "Missing X-Gemini-Key header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Clone headers to strip sensitive ones and inject real key if we were acting as a true proxy
    // In this BYOK architecture, we pass the client's key through, or validation logic here.
    const newHeaders = new Headers(request.headers);
    newHeaders.delete("X-Gemini-Key");
    // Forward the key as the query param 'key' or header 'x-goog-api-key' depending on Google's requirement.
    // The Google GenAI SDK usually appends ?key=... or uses x-goog-api-key. 
    // Since the SDK is used on client, this worker acts as a transparent proxy if base URL is changed.
    newHeaders.set("x-goog-api-key", clientKey);

    try {
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
      });

      const response = await fetch(modifiedRequest);

      // Handle Rate Limiting (429)
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: "Quota Exceeded",
          retryAfter: response.headers.get("Retry-After") || "60"
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Support SSE / Streaming if content-type is text/event-stream
      const newResponseHeaders = new Headers(response.headers);
      newResponseHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { "Access-Control-Allow-Origin": "*" } 
      });
    }
  },
};
