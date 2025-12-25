import { GoogleGenAI, Part } from "@google/genai";

// Helper: Resize image to max dimension (e.g. 1536px) to avoid payload limits
const MAX_DIMENSION = 1536;

export const resizeImageBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Remove the Data URL prefix (data:image/jpeg;base64,)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // 85% quality
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Helper: Retry logic for API calls (Exponential backoff)
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status === 503 || error.message?.includes('overloaded'))) {
      console.warn(`Retrying operation... attempts left: ${retries}. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- API Functions ---

// 1. Remove Background (Extraction)
export const removeBackground = async (apiKey: string, imageBase64: string): Promise<string> => {
  const operation = async () => {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: "Identify the main clothing item or fashion product in this image. Generate a new high-quality image of JUST that product on a pure white background. Ensure the edges are clean and precise." }
        ]
      }
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
       if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
       }
    }
    throw new Error("No image generated.");
  };

  return retryOperation(operation);
};

// 2. Virtual Try-On
export const virtualTryOn = async (apiKey: string, personImageBase64: string, clothImageBase64: string): Promise<string> => {
  const operation = async () => {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash-image';

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: personImageBase64 } },
          { inlineData: { mimeType: 'image/jpeg', data: clothImageBase64 } },
          { text: "You are an expert fashion stylist. The first image is a person (model). The second image is a garment. Generate a photorealistic image of the person from the first image wearing the garment from the second image. Maintain the person's pose, lighting, and physical features. Ensure the fabric physics look natural." }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
       if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
       }
    }
    throw new Error("No image generated.");
  };

  return retryOperation(operation);
};

// 3. Generate Scene
export const generateScene = async (apiKey: string, imageBase64: string, prompt: string): Promise<string> => {
  const operation = async () => {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash-image';

    const fullPrompt = `Keep the main subject (person/fashion item) from this image exactly as is, but change the background and environment to: ${prompt}. Ensure lighting integration is realistic. High fashion photography style.`;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: fullPrompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
       if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
       }
    }
    throw new Error("No image generated.");
  };

  return retryOperation(operation);
};

// 4. Generate Video (Veo)
export const generateFashionVideo = async (apiKey: string, imageBase64: string): Promise<string> => {
  const operation = async () => {
    const ai = new GoogleGenAI({ apiKey });
    // Using Veo model for video generation
    const model = 'veo-3.1-fast-generate-preview';

    // Start video generation operation
    let videoOp = await ai.models.generateVideos({
      model,
      prompt: "Cinematic fashion shot, slow motion camera pan, professional studio lighting, high resolution, 4k.",
      image: {
        imageBytes: imageBase64,
        mimeType: 'image/jpeg'
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Mobile first video
      }
    });

    // Poll for completion
    while (!videoOp.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5s
      videoOp = await ai.operations.getVideosOperation({ operation: videoOp });
    }

    const videoUri = videoOp.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("Video generation failed or no URI returned.");
    }

    // The URI needs the API key appended to fetch the binary
    return `${videoUri}&key=${apiKey}`;
  };

  return retryOperation(operation);
};
