import { GoogleGenAI } from "@google/genai";
import { ModelType } from "../types";

// Helper to initialize client safely
const getClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export const generateTryOn = async (
  apiKey: string,
  personImageBase64: string,
  clothingImageBase64: string
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    
    // Core Prompt from requirements
    const prompt = "Photorealistic virtual try-on. Put the clothing from the second image onto the person in the first image. Natural lighting and wrinkles. Ensure the product is perfectly isolated from its original background before fitting.";

    const response = await ai.models.generateContent({
      model: ModelType.IMAGE_GEN,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: personImageBase64
            }
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: clothingImageBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
         // thinkingConfig: { thinkingBudget: 0 } // Not needed for image model
      }
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("Không nhận được dữ liệu hình ảnh từ AI.");
  } catch (error: any) {
    if (error.message?.includes('429')) {
      throw new Error("Hệ thống đang quá tải (429). Vui lòng thử lại sau 30 giây.");
    }
    throw error;
  }
};

export const generateBackground = async (
  apiKey: string,
  productImageBase64: string,
  sceneDescription: string
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    const prompt = `Professional product photography. Place this object into the following scene: ${sceneDescription}. High resolution, photorealistic, perfect lighting match, realistic shadows and reflections.`;

    const response = await ai.models.generateContent({
      model: ModelType.IMAGE_GEN,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: productImageBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Không thể tạo bối cảnh. Vui lòng thử lại.");
  } catch (error: any) {
     if (error.message?.includes('429')) {
      throw new Error("Hệ thống đang quá tải (429). Vui lòng thử lại sau 30 giây.");
    }
    throw error;
  }
};

export const generateVideo = async (
  apiKey: string,
  imageBase64: string,
  promptText: string
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    
    let operation = await ai.models.generateVideos({
      model: ModelType.VIDEO_GEN,
      prompt: promptText || "Cinematic product showcase, slow camera pan, 4k high quality, professional lighting.",
      image: {
        imageBytes: imageBase64,
        mimeType: 'image/jpeg'
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Mobile optimized
      }
    });

    // Polling logic
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed to return a URI");

    // Important: Fetch the actual video blob using the key
    const videoResponse = await fetch(`${videoUri}&key=${apiKey}`);
    if (!videoResponse.ok) throw new Error("Failed to download generated video");
    
    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error: any) {
     if (error.message?.includes('429')) {
      throw new Error("Hệ thống quá tải video (429). Vui lòng thử lại sau 1 phút.");
    }
    throw error;
  }
};