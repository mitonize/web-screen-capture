import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { resizeToThumbnail } from '../src/core/image-processor.js';

describe('resizeToThumbnail', () => {
  it('creates a 300x300 thumbnail from a wide image without extract errors', async () => {
    const wideImage = await sharp({
      create: {
        width: 1200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const thumbnail = await resizeToThumbnail(wideImage);
    const metadata = await sharp(thumbnail).metadata();

    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(300);
  });

  it('creates a 300x300 thumbnail from a tall image', async () => {
    const tallImage = await sharp({
      create: {
        width: 200,
        height: 1200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const thumbnail = await resizeToThumbnail(tallImage);
    const metadata = await sharp(thumbnail).metadata();

    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(300);
  });
});
