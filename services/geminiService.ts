import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

type AppMode = 'standard' | 'premium';

// --- HELPER: Resize ảnh ---
const resizeImage = (base64Str: string, maxWidth = 4096): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      if (img.width <= maxWidth && img.height <= maxWidth) {
         resolve(base64Str);
         return;
      }
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png')); 
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    let errString = "";
    if (typeof error === 'object') {
        errString = JSON.stringify(error);
    } else {
        errString = String(error);
    }
    
    const isQuotaError = errString.includes('429') || 
                         errString.includes('RESOURCE_EXHAUSTED') || 
                         errString.includes('quota') ||
                         (error?.status === 429) || 
                         (error?.status === 503);

    if (retries > 0 && isQuotaError) {
      console.warn(`Hết hạn mức. Đang thử lại sau ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

const getModelConfig = (mode: AppMode) => {
  if (mode === 'premium') {
    return {
      model: 'gemini-3-pro-image-preview',
      imageConfig: { imageSize: "4K" }
    };
  }
  return {
    model: 'gemini-2.5-flash-image',
    imageConfig: undefined
  };
};

export const isolateProduct = async (sourceBase64: string, mode: AppMode = 'standard'): Promise<string> => {
  // Luôn tạo instance mới trước khi call để lấy API_KEY mới nhất
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = getModelConfig(mode);
  const optimizedImage = await resizeImage(sourceBase64);

  const prompt = `
      TASK: ADVANCED GHOST MANNEQUIN CREATION.
      INPUT: A clothing item worn by a MANNEQUIN or MODEL.
      GOAL: Return ONLY the cloth item on a transparent/white background.
      - REMOVE MANNEQUINS, STANDS, AND POLES.
      - RECONSTRUCT NECKLINE if hidden.
      - Clean edges, floating garment look.
  `;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: {
        parts: [
          { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: { imageConfig: config.imageConfig as any }
    });

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Không thể tách nền.`);
  });
};

export const compositeProduct = async (isolatedBase64: string, templateBase64: string, mode: AppMode = 'standard'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = getModelConfig(mode);
  const optimizedIso = await resizeImage(isolatedBase64);
  const optimizedTemp = await resizeImage(templateBase64);

  const prompt = `
      TASK: REALISTIC VIRTUAL TRY-ON. Apply the cloth from image 1 onto the model in image 2.
      - Wrap naturally around body curves.
      - Preserve cloth texture and model identity.
      - Match lighting and shadows.
  `;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: {
        parts: [
          { inlineData: { data: optimizedIso.split(',')[1], mimeType: 'image/png' } },
          { inlineData: { data: optimizedTemp.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: { imageConfig: config.imageConfig as any }
    });

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Không thể ghép ảnh.`);
  });
};

export const replaceBackground = async (imageBase64: string, userPrompt: string, mode: AppMode = 'standard', aspectRatio: string = '1:1'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const baseConfig = getModelConfig(mode);
  const optimizedImage = await resizeImage(imageBase64);

  const prompt = `
  TASK: CINEMATIC BACKGROUND REPLACEMENT. Subject: ${userPrompt}.
  - Realistic shadows and grounding.
  - Lighting interaction with the new environment.
  - Sharp subject preservation.
  `;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: baseConfig.model,
      contents: {
        parts: [
          { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          ...(baseConfig.imageConfig || {}),
          aspectRatio: aspectRatio
        } as any
      }
    });

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Không thể thay đổi bối cảnh.`);
  });
};

export const replaceBackgroundWithImage = async (subjectBase64: string, bgBase64: string, mode: AppMode = 'standard', aspectRatio: string = '1:1'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const baseConfig = getModelConfig(mode);
  const optimizedSubject = await resizeImage(subjectBase64);
  const optimizedBg = await resizeImage(bgBase64);

  const prompt = `
  TASK: EXPERT PHOTO COMPOSITING. Place subject 1 into background 2.
  - Realistic contact and cast shadows.
  - Relighting to match color temperature.
  - Color harmony and light wrap.
  `;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: baseConfig.model,
      contents: {
        parts: [
          { inlineData: { data: optimizedSubject.split(',')[1], mimeType: 'image/png' } },
          { inlineData: { data: optimizedBg.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          ...(baseConfig.imageConfig || {}),
          aspectRatio: aspectRatio
        } as any
      }
    });

    if (response.candidates?.[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Không thể ghép nền mới.`);
  });
};

export const suggestBackgroundIdeas = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = base64Image;
  await new Promise(r => img.onload = r);
  canvas.width = 512;
  canvas.height = 512 * (img.height / img.width);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const optimizedImage = canvas.toDataURL('image/jpeg', 0.8);

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/jpeg' } },
          { text: `Analyze outfit. Suggest ONE matching realistic background. Max 20 words.` }
        ]
      }
    });
    return response.text?.trim() || "A luxury modern studio background";
  });
};

export const suggestVideoPrompt = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = base64Image;
  await new Promise(r => img.onload = r);
  canvas.width = 512;
  canvas.height = 512 * (img.height / img.width);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const optimizedImage = canvas.toDataURL('image/jpeg', 0.8);

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/jpeg' } },
          { text: "Write a high-quality, cinematic text prompt for Veo video generation based on this image." }
        ]
      }
    });
    return response.text || "Cinematic product showcase.";
  });
};

interface VideoConfig {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  mode: AppMode;
  prompt: string;
}

export const generateSalesVideo = async (
  imageParams: { base64: string, mimeType: string },
  config: VideoConfig
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = config.mode === 'premium' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
  const optimizedImage = await resizeImage(imageParams.base64);

  let operation = await ai.models.generateVideos({
    model: modelName,
    prompt: config.prompt,
    image: { imageBytes: optimizedImage.split(',')[1], mimeType: 'image/png' },
    config: { numberOfVideos: 1, resolution: config.resolution, aspectRatio: config.aspectRatio }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};