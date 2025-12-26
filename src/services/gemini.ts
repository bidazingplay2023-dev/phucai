import { proxyFetch } from './client';
import { cleanBase64 } from '../utils/image';

const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // 429: Too Many Requests, 503: Service Unavailable
      if (error.message?.includes('429') || error.message?.includes('503')) {
        console.warn(`Attempt ${i + 1} failed, retrying...`);
        await sleep(RETRY_DELAY * (i + 1));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * FEATURE 1: Virtual Fit (Merged Workflow)
 * Uses gemini-2.5-flash-image
 */
export const generateVirtualFit = async (
  productBase64: string,
  modelBase64: string,
  apiKey: string
): Promise<string> => {
  const prompt = `
    Role: Expert Fashion Compositor.
    Task: Create a photorealistic "Virtual Try-On" image.
    Input 1: Garment (Isolated product).
    Input 2: Model (Person).
    Action:
    1. Extract the garment from Input 1.
    2. Realistically drape it onto the model in Input 2.
    3. Match the lighting, shadows, and perspective of Input 2 exactly.
    4. Ensure the fabric physics (folds, weight) look natural on the body.
    Output: ONLY the final composited image.
  `;

  return retryOperation(async () => {
    const data = await proxyFetch('v1beta/models/gemini-2.5-flash-image:generateContent', {
      apiKey,
      body: {
        contents: {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: cleanBase64(productBase64) } },
            { inline_data: { mime_type: 'image/jpeg', data: cleanBase64(modelBase64) } }
          ]
        }
      }
    });

    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part?.inline_data?.data) {
      return `data:image/png;base64,${part.inline_data.data}`;
    }
    throw new Error("No image generated.");
  });
};

/**
 * FEATURE 2: Scene Magic
 */
export const generateSceneMagic = async (
  imageBase64: string,
  scenePrompt: string,
  apiKey: string
): Promise<string> => {
  const fullPrompt = `
    Editor Mode: Background Replacement.
    Input Image: Fashion Model.
    Instruction: Replace the background with: "${scenePrompt}".
    Constraint: Keep the model and their clothing EXACTLY as is. Do not alter the face or the garment.
    Style: High-end e-commerce photography.
  `;

  return retryOperation(async () => {
    const data = await proxyFetch('v1beta/models/gemini-2.5-flash-image:generateContent', {
      apiKey,
      body: {
        contents: {
          parts: [
            { text: fullPrompt },
            { inline_data: { mime_type: 'image/jpeg', data: cleanBase64(imageBase64) } }
          ]
        }
      }
    });

    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part?.inline_data?.data) {
      return `data:image/png;base64,${part.inline_data.data}`;
    }
    throw new Error("No image generated.");
  });
};

/**
 * FEATURE 3: Cinematic Video (Veo)
 * Manually implements the Long-Running Operation (LRO) polling via Proxy
 */
export const generateCinematicVideo = async (
  prompt: string,
  apiKey: string,
  imageBase64?: string
): Promise<string> => {
  
  // 1. Start Operation
  const startResponse = await proxyFetch('v1beta/models/veo-3.1-fast-generate-preview:generateVideos', {
    apiKey,
    body: {
      prompt,
      ...(imageBase64 && {
        image: {
          image_bytes: cleanBase64(imageBase64),
          mime_type: 'image/png'
        }
      }),
      config: {
        number_of_videos: 1,
        resolution: '720p',
        aspect_ratio: '9:16'
      }
    }
  });

  // The response is an Operation object: { name: "projects/.../operations/..." }
  let operationName = startResponse.name;
  if (!operationName) throw new Error("Failed to start video generation");

  // 2. Poll Operation
  console.log("Video Op Started:", operationName);
  
  let videoUri: string | null = null;
  
  while (!videoUri) {
    await sleep(5000); // Poll every 5s
    const opStatus = await proxyFetch(`v1beta/${operationName}`, {
      apiKey,
      method: 'GET'
    });

    if (opStatus.error) {
      throw new Error(opStatus.error.message);
    }

    if (opStatus.done) {
      const vid = opStatus.response?.generatedVideos?.[0] || opStatus.response?.generated_videos?.[0];
      videoUri = vid?.video?.uri;
      if (!videoUri) throw new Error("Operation done but no video URI found.");
    }
  }

  // 3. Download Video
  // We need to fetch the bytes because the URI usually requires the key too.
  // We can route this through our proxy or fetch directly if it's a public bucket (usually it's not).
  // Veo URIs are usually `https://generativelanguage.googleapis.com/v1beta/files/...`
  // We can proxy this download as well to keep the key hidden.
  
  const fileId = videoUri.split('/').pop(); // Extract file ID or path
  // Construct a proxy path for the file. 
  // Note: The URI returned is usually a full URL. We need to strip the domain to pass to our proxy.
  const proxyPath = videoUri.replace('https://generativelanguage.googleapis.com/', '');
  
  const videoBlobRes = await fetch(`/api/${proxyPath}`, {
    headers: { 'X-Gemini-Key': apiKey }
  });

  if (!videoBlobRes.ok) throw new Error("Failed to download final video file");
  
  const blob = await videoBlobRes.blob();
  return URL.createObjectURL(blob);
};
