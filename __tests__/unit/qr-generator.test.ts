import { describe, it, expect } from 'vitest';
import { generateQrCodeBuffer } from '../../lib/qr-generator';

describe('generateQrCodeBuffer', () => {
  it('should return a Buffer', async () => {
    const result = await generateQrCodeBuffer('INV/24-25/0001');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should return a valid PNG buffer (starts with PNG signature)', async () => {
    const result = await generateQrCodeBuffer('INV/24-25/0001');
    // PNG files start with the 8-byte signature: 137 80 78 71 13 10 26 10
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(result.subarray(0, 8)).toEqual(pngSignature);
  });

  it('should handle strings with special characters (forward slashes)', async () => {
    const result = await generateQrCodeBuffer('INV/2024-25/0001');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce a non-empty buffer for non-empty input', async () => {
    const result = await generateQrCodeBuffer('test');
    expect(result.length).toBeGreaterThan(0);
  });
});
