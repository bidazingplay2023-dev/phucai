import { GoogleGenAI } from "@google/genai";

type AppMode = 'standard' | 'premium';

// --- HELPER: Resize image to fit within API limits if necessary ---
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

// Retry logic for 429 errors
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    let errString = typeof error === 'object' ? JSON.stringify(error) : String(error);
    
    const isQuotaError = errString.includes('429') || 
                         errString.includes('RESOURCE_EXHAUSTED') || 
                         errString.includes('quota') ||
                         (error?.status === 429);

    if (retries > 0 && isQuotaError) {
      console.warn(`Quota exceeded. Retrying in ${delay/1000}s...`);
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
    imageConfig: { aspectRatio: "1:1" }
  };
};

export const isolateProduct = async (sourceBase64: string, mode: AppMode = 'standard'): Promise<string> => {
  // Use process.env.API_KEY directly and instantiate inside function for latest value
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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

    // Iterate parts to find the image part as per guidelines
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Failed to isolate product.`);
  });
};

export const compositeProduct = async (isolatedBase64: string, templateBase64: string, mode: AppMode = 'standard'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Failed to composite image.`);
  });
};

export const replaceBackground = async (imageBase64: string, userPrompt: string, mode: AppMode = 'standard', aspectRatio: string = '1:1'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const baseConfig = getModelConfig(mode);
  const optimizedImage = await resizeImage(imageBase64);

  const prompt = `
  TASK: CINEMATIC BACKGROUND REPLACEMENT. Subject description: ${userPrompt}.
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

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Failed to replace background.`);
  });
};

export const replaceBackgroundWithImage = async (subjectBase64: string, bgBase64: string, mode: AppMode = 'standard', aspectRatio: string = '1:1'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const baseConfig = getModelConfig(mode);
  const optimizedSubject = await resizeImage(subjectBase64);
  const optimizedBg = await resizeImage(bgBase64);

  const prompt = `
  TASK: EXPERT PHOTO COMPOSITING. Place subject from image 1 into background from image 2.
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

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Failed to composite new background.`);
  });
};

export const generateSalesVideo = async (
  imageParams: { base64: string, mimeType: string },
  config: VideoConfig
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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
  // Always append API key when fetching from download link for Veo models as per guidelines
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download video file.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

interface VideoConfig {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  mode: AppMode;
  prompt: string;
}
