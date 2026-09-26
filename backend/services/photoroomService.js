const PHOTOROOM_API_URL = "https://sdk.photoroom.com/v1/segment";

/**
 * Remove the background from an image using Photoroom.
 *
 * @param {Buffer} imageBuffer
 * @param {string} filename
 * @param {string} mimeType
 * @returns {Promise<Buffer>}
 */
export async function removeBackground(
  imageBuffer,
  filename = "image.jpg",
  mimeType = "image/jpeg"
) {
  const apiKey = process.env.PHOTOROOM_API_KEY;

  if (!apiKey) {
    throw new Error("PHOTOROOM_API_KEY is not configured");
  }

  if (!imageBuffer || !imageBuffer.length) {
    throw new Error("Image buffer is empty");
  }

  const blob = new Blob([imageBuffer], {
    type: mimeType,
  });

  const formData = new FormData();

  formData.append("image_file", blob, filename);

  const response = await fetch(PHOTOROOM_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Photoroom API error ${response.status}: ${errorText}`
    );
  }

  const resultArrayBuffer = await response.arrayBuffer();

  return Buffer.from(resultArrayBuffer);
}