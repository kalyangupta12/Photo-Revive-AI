/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from "@google/genai";

// --- DOM Elements ---
const fileUpload = document.getElementById("file-upload") as HTMLInputElement;
const enhanceButton = document.getElementById(
  "enhance-button",
) as HTMLButtonElement;
const downloadButton = document.getElementById(
  "download-button",
) as HTMLButtonElement;
const originalImage = document.getElementById(
  "original-image",
) as HTMLImageElement;
const enhancedImage = document.getElementById(
  "enhanced-image",
) as HTMLImageElement;
const loader = document.getElementById("loader") as HTMLDivElement;
const originalPlaceholder = document.getElementById(
  "original-placeholder",
) as HTMLDivElement;
const enhancedPlaceholder = document.getElementById(
  "enhanced-placeholder",
) as HTMLDivElement;

let uploadedFile: File | null = null;

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const SYSTEM_PROMPT = `Restore this photo via the following sequential steps.
1. Increase the contrast, saturation, and other attributes that will make the photo's details come to life again.
2. Fill in any areas of the photo that are empty with new details that would make sense in the existing context.
3. Colorize the photo.
4. Add any final touches that will turn this from a faded old photo to one that looks like it was recently taken.`;

/**
 * Converts a File object to a base64 string.
 */
function fileToBase64(file: File): Promise<{
  base64: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Handles the file input change event.
 */
async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    uploadedFile = target.files[0];

    originalPlaceholder.hidden = true;
    originalImage.src = URL.createObjectURL(uploadedFile);
    originalImage.hidden = false;
    enhanceButton.disabled = false;
    
    // Reset enhanced image view
    enhancedImage.hidden = true;
    enhancedImage.src = "";
    enhancedPlaceholder.hidden = false;
    downloadButton.disabled = true;
  }
}

/**
 * Calls the Gemini API to enhance the uploaded image.
 */
async function enhanceImageApi() {
  if (!uploadedFile) {
    alert("Please upload an image first.");
    return;
  }

  setLoading(true);

  try {
    const { base64, mimeType } = await fileToBase64(uploadedFile);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType: mimeType,
            },
          },
          {
            text: SYSTEM_PROMPT,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    );
    if (imagePart && imagePart.inlineData) {
      const enhancedBase64 = imagePart.inlineData.data;
      const enhancedMimeType = imagePart.inlineData.mimeType || "image/png"; // Default to png if not provided
      enhancedPlaceholder.hidden = true;
      enhancedImage.src = `data:${enhancedMimeType};base64,${enhancedBase64}`;
      enhancedImage.hidden = false;
      downloadButton.disabled = false;
    } else {
      console.error("No image part found in the response", response);
      alert("Could not enhance the image. Please try again.");
    }
  } catch (error) {
    console.error("Error enhancing image:", error);
    alert("An error occurred while enhancing the image. See console for details.");
  } finally {
    setLoading(false);
  }
}

/**
 * Triggers the download of the enhanced image.
 */
function downloadImage() {
  if (!enhancedImage.src || enhancedImage.hidden) {
    return;
  }
  const a = document.createElement("a");
  a.href = enhancedImage.src;
  a.download = "enhanced-photo.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


/**
 * Manages the loading state of the UI.
 */
function setLoading(isLoading: boolean) {
  loader.hidden = !isLoading;
  enhanceButton.disabled = isLoading;
  fileUpload.disabled = isLoading;
  
  if (isLoading) {
    downloadButton.disabled = true; // Always disable during loading
    enhancedPlaceholder.hidden = true;
    enhancedImage.hidden = true;
  }
}

// --- Event Listeners ---
fileUpload.addEventListener("change", handleFileChange);
enhanceButton.addEventListener("click", enhanceImageApi);
downloadButton.addEventListener("click", downloadImage);