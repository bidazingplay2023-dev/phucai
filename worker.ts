/**
 * CLOUDFLARE WORKER CODE
 * File này chứa logic backend edge gateway.
 * Triển khai file này lên Cloudflare Workers để bảo vệ API Key gốc nếu cần backend proxy.
 */

interface Env {
  GEMINI_API_KEY: string; // Khóa API gốc của hệ thống (nếu dùng chung)
}

export default {
  // Fix: Replace ExecutionContext with any to avoid type error and fix logic for OPTIONS/POST
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key',
    };

    // Fix: Handle OPTIONS first to avoid unreachable code
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Chỉ chấp nhận method POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Lấy Client Key từ Header (BYOK Architecture)
    const clientKey = request.headers.get('X-Gemini-Key');
    const apiKeyToUse = clientKey || env.GEMINI_API_KEY;

    if (!apiKeyToUse) {
      return new Response(JSON.stringify({ error: 'Missing API Key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cấu trúc lại URL gọi đến Google
    // Ví dụ: Proxy request đến endpoint generateContent
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKeyToUse}`;

    try {
      const body = await request.json();
      
      // Strip sensitive headers, chỉ forward body
      const response = await fetch(googleApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      // Xử lý Rate Limiting (429)
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Rate Limit Exceeded',
          retryAfter: 60 // Giả định chờ 60s
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Hỗ trợ Streaming (SSE) nếu response header là stream
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        return new Response(response.body, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};