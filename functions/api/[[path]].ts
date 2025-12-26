/**
 * Cloudflare Pages Function: Reverse Proxy for Google Gemini API
 * 
 * Architecture:
 * Client -> POST /api/v1beta/... -> This Worker -> Google API
 * 
 * Security:
 * - Checks for X-Gemini-Key header.
 * - Does not log the key.
 * - Handles CORS to allow requests from the specific domain.
 */

// Fix: Remove PagesFunction type as it is not available in the global scope
export const onRequest = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);

  // 1. CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*", // Lock this down to your domain in production
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Key",
      },
    });
  }

  // 2. Extract Path for Google API
  // Incoming: https://mydomain.com/api/v1beta/models/gemini-flash:generateContent
  // Target: https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent
  const path = url.pathname.replace(/^\/api\//, ""); // Remove '/api/' prefix

  if (!path) {
    return new Response("Invalid API path", { status: 400 });
  }

  const targetUrl = `https://generativelanguage.googleapis.com/${path}${url.search}`;

  // 3. Authenticate
  const apiKey = request.headers.get("X-Gemini-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API Key" }), {
      status: 401,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  }

  // 4. Forward Request
  // We attach the key as a query parameter as required by Google's REST API,
  // but we source it from the secure header so it wasn't in the client's URL bar.
  const signedUrl = new URL(targetUrl);
  signedUrl.searchParams.append("key", apiKey);

  try {
    const googleResponse = await fetch(signedUrl.toString(), {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        // Pass minimal headers to avoid conflicts
      },
      body: request.body,
    });

    // 5. Return Response
    const responseBody = await googleResponse.text();
    
    return new Response(responseBody, {
      status: googleResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy Error", details: String(error) }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
};