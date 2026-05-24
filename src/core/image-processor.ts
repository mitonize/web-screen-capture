import sharp from 'sharp';

/**
 * Resize image to thumbnail (300x300px)
 * - Scale based on width (set width to 300px, maintain aspect ratio)
 * - Crop from top to 300px height
 */
export async function resizeToThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  const THUMB_SIZE = 300;

  // Get metadata to calculate dimensions
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Failed to read image metadata');
  }

  // Calculate height after scaling width to THUMB_SIZE
  const scaledHeight = Math.round((metadata.height * THUMB_SIZE) / metadata.width);

  // Resize to target width (maintaining aspect ratio)
  // Then extract (crop) top 300px
  return sharp(imageBuffer)
    .resize(THUMB_SIZE, scaledHeight, {
      fit: 'fill',
      position: 'top',
    })
    .extract({
      left: 0,
      top: 0,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    })
    .toBuffer();
}
