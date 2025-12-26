
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight (OPTIONS)
    // Cho phép tất cả các nguồn (Origin), Headers, và Methods
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Hoặc thay "*" bằng domain cụ thể của bạn để bảo mật hơn
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "*", // Chấp nhận mọi header mà SDK gửi lên
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // 2. Construct Target URL
    // SDK thường gửi request dạng: /v1beta/models/...
    // Worker sẽ chuyển tiếp y nguyên path và query params sang Google
    const targetUrl = new URL(url.pathname + url.search, "https://generativelanguage.googleapis.com");

    // 3. Handle API Key
    // SDK @google/genai thường gửi key qua header 'x-goog-api-key' hoặc query param.
    // Nếu client gửi qua X-Gemini-Key (custom), ta chuyển nó sang header Google cần.
    const clientKey = request.headers.get("X-Gemini-Key");
    
    const newHeaders = new Headers(request.headers);
    // Xóa các header của Cloudflare có thể gây lỗi khi forward
    newHeaders.delete("Host");
    newHeaders.delete("Cf-Ray");
    newHeaders.delete("Cf-Visitor");
    newHeaders.delete("Cf-Ipcountry");
    newHeaders.delete("X-Forwarded-Proto");
    newHeaders.delete("X-Real-Ip");

    // Logic xử lý Key: Ưu tiên X-Gemini-Key nếu có, nếu không giữ nguyên header gốc SDK gửi
    if (clientKey) {
      newHeaders.set("x-goog-api-key", clientKey);
      newHeaders.delete("X-Gemini-Key");
    }

    // Luôn set Content-Type nếu body tồn tại
    if (!newHeaders.get("Content-Type")) {
        newHeaders.set("Content-Type", "application/json");
    }

    try {
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });

      const response = await fetch(modifiedRequest);

      // 4. Handle Rate Limiting (429) gracefully
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: {
            code: 429,
            message: "Quota Exceeded. Please try again later.",
            status: "RESOURCE_EXHAUSTED"
          }
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": response.headers.get("Retry-After") || "60"
          }
        });
      }

      // 5. Return Response with CORS
      // Phải clone response để chỉnh sửa headers
      const newResponseHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newResponseHeaders.set(key, corsHeaders[key]);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { 
            ...corsHeaders,
            "Content-Type": "application/json" 
        } 
      });
    }
  },
};
