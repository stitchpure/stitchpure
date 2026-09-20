/**
 * QR code generation wrapper for invoice PDF embedding.
 * Thin wrapper around the `qrcode` npm package producing PNG buffers.
 * Package is loaded on demand when an invoice PDF is generated.
 *
 * Requirements: 5.1, 5.3, 5.4
 */

/**
 * Generate a QR code PNG buffer encoding the given string.
 * Uses error correction level M (15% recovery).
 * Output is a square image suitable for embedding in PDF.
 */
export async function generateQrCodeBuffer(data: string): Promise<Buffer> {
  const QRCode = (await import("qrcode")).default;
  const buffer = await QRCode.toBuffer(data, {
    errorCorrectionLevel: "M",
    type: "png",
    margin: 1,
    width: 200,
  });

  return buffer;
}
