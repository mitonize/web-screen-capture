import sharp from 'sharp';

/**
 * Resize image to thumbnail (300x300px)
 * - Create a square thumbnail with top-biased crop
 */
export async function resizeToThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  const THUMB_SIZE = 300;

  // Get metadata to calculate dimensions
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Failed to read image metadata');
  }

  // Always output exactly THUMB_SIZE x THUMB_SIZE and crop from top when needed.
  // Using fit=cover avoids out-of-bounds extract errors for wide images.
  return sharp(imageBuffer)
    .resize(THUMB_SIZE, THUMB_SIZE, {
      fit: 'cover',
      position: 'north',
    })
    .toBuffer();
}
