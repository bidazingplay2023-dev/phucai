/**
 * Tiện ích xử lý ảnh chuyên nghiệp cho E-commerce.
 * Tự động resize về max 2048px (chuẩn Gemini) và nén JPEG chất lượng 0.8.
 */

export const processImage = async (file: File): Promise<{ base64: string; previewUrl: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 2048;

        // Resize logic keeping aspect ratio
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Không thể khởi tạo Canvas context"));
          return;
        }

        // Vẽ ảnh lên canvas (White background để tránh lỗi transparency nếu nén JPEG)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export to JPEG 0.8 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];

        resolve({
          base64,
          previewUrl: dataUrl,
          mimeType: 'image/jpeg'
        });
      };
      img.onerror = () => reject(new Error("Lỗi khi tải hình ảnh"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file"));
    reader.readAsDataURL(file);
  });
};

export const downloadImage = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};