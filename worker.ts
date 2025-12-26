
export interface Env {
  // Biến môi trường nếu cần
}

export default {
  // Fix: Use any for ctx as ExecutionContext is not globally defined
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const targetUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;

    // 1. Lấy API Key từ header tùy chỉnh X-Gemini-Key
    const geminiKey = request.headers.get('X-Gemini-Key');

    // 2. Chuẩn bị headers mới (Strip sensitive headers)
    const newHeaders = new Headers(request.headers);
    newHeaders.delete('X-Gemini-Key');
    newHeaders.delete('Cookie');
    newHeaders.delete('User-Agent');
    
    if (geminiKey) {
      newHeaders.set('x-goog-api-key', geminiKey);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow',
      });

      // 3. Xử lý lỗi 429 (Rate Limit)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: "Hệ thống đang quá tải. Vui lòng thử lại sau.",
              retryAfter: parseInt(retryAfter)
            }
          }),
          { 
            status: 429, 
            headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter } 
          }
        );
      }

      // 4. Hỗ trợ Server-Sent Events (SSE) cho streaming
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('text/event-stream')) {
        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        });
      }

      return response;
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: { message: error.message || "Gateway Error" } }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
