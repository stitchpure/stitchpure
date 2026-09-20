import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock JsBarcode before importing the module
vi.mock('jsbarcode', () => ({
  default: vi.fn((svg: SVGElement, _data: string, _options: unknown) => {
    // Simulate JsBarcode setting SVG content
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '40');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '200');
    rect.setAttribute('height', '40');
    svg.appendChild(rect);
  }),
}));

// We need jsdom or similar for DOM APIs - mock them at global level
beforeEach(() => {
  // Mock XMLSerializer
  (globalThis as any).XMLSerializer = class {
    serializeToString(node: Node): string {
      // Return a simple SVG string for testing
      return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><rect width="200" height="40"/></svg>';
    }
  };

  // Mock btoa
  (globalThis as any).btoa = (str: string) => Buffer.from(str).toString('base64');

  // Mock document.createElementNS
  const mockSvg = {
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    namespaceURI: 'http://www.w3.org/2000/svg',
    nodeName: 'svg',
    childNodes: [],
    nodeType: 1,
  };

  if (typeof document === 'undefined') {
    (globalThis as any).document = {
      createElementNS: vi.fn(() => mockSvg),
    };
  } else {
    vi.spyOn(document, 'createElementNS').mockReturnValue(mockSvg as any);
  }
});

describe('lib/barcode', () => {
  describe('generateBarcodeDataUrl', () => {
    it('should return a data URL string', async () => {
      const { generateBarcodeDataUrl } = await import('../../lib/barcode');
      const result = generateBarcodeDataUrl('SKU-001');
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should produce a non-empty base64 payload', async () => {
      const { generateBarcodeDataUrl } = await import('../../lib/barcode');
      const result = generateBarcodeDataUrl('EVA-SLP-07');
      const base64Part = result.replace('data:image/svg+xml;base64,', '');
      expect(base64Part.length).toBeGreaterThan(0);
    });

    it('should call JsBarcode with CODE128 format', async () => {
      const JsBarcode = (await import('jsbarcode')).default;
      const { generateBarcodeDataUrl } = await import('../../lib/barcode');
      generateBarcodeDataUrl('TEST-SKU');
      expect(JsBarcode).toHaveBeenCalledWith(
        expect.anything(),
        'TEST-SKU',
        expect.objectContaining({ format: 'CODE128' })
      );
    });
  });

  describe('generateLabelHtml', () => {
    it('should contain the SKU text', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'EVA-SLP-07',
        productName: 'EVA Slipper',
        variantInfo: 'Size 7',
      });
      expect(html).toContain('EVA-SLP-07');
    });

    it('should contain the product name', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'EVA-SLP-07',
        productName: 'EVA Slipper',
        variantInfo: 'Size 7',
      });
      expect(html).toContain('EVA Slipper');
    });

    it('should contain the variant info', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'EVA-SLP-07',
        productName: 'EVA Slipper',
        variantInfo: 'Size 7',
      });
      expect(html).toContain('Size 7');
    });

    it('should NOT contain any price information', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'EVA-SLP-07',
        productName: 'EVA Slipper',
        variantInfo: 'Size 7',
      });
      // Labels should not contain currency symbols or price-related content
      expect(html).not.toMatch(/₹|price|Price|MRP|mrp|\$|cost|Cost/);
    });

    it('should include 50mm × 25mm label dimensions', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'SKU-001',
        productName: 'Test Product',
        variantInfo: 'Red / XL',
      });
      expect(html).toContain('50mm');
      expect(html).toContain('25mm');
    });

    it('should include a barcode image', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: 'SKU-001',
        productName: 'Test Product',
        variantInfo: 'Red / XL',
      });
      expect(html).toContain('<img');
      expect(html).toContain('data:image/svg+xml;base64,');
    });

    it('should escape HTML special characters to prevent XSS', async () => {
      const { generateLabelHtml } = await import('../../lib/barcode');
      const html = generateLabelHtml({
        sku: '<script>alert("xss")</script>',
        productName: 'Test & "Product"',
        variantInfo: "It's <b>big</b>",
      });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
    });
  });

  describe('generateBatchLabelsHtml', () => {
    it('should produce a full HTML document', async () => {
      const { generateBatchLabelsHtml } = await import('../../lib/barcode');
      const html = generateBatchLabelsHtml([
        { sku: 'SKU-001', productName: 'Product A', variantInfo: 'Size 7' },
      ]);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
    });

    it('should produce one label element per item', async () => {
      const { generateBatchLabelsHtml } = await import('../../lib/barcode');
      const items = [
        { sku: 'SKU-001', productName: 'Product A', variantInfo: 'Size 7' },
        { sku: 'SKU-002', productName: 'Product B', variantInfo: 'Size 8' },
        { sku: 'SKU-003', productName: 'Product C', variantInfo: 'Red / XL' },
      ];
      const html = generateBatchLabelsHtml(items);
      const labelCount = (html.match(/class="barcode-label"/g) || []).length;
      expect(labelCount).toBe(3);
    });

    it('should include CSS print media queries for thermal printer', async () => {
      const { generateBatchLabelsHtml } = await import('../../lib/barcode');
      const html = generateBatchLabelsHtml([
        { sku: 'SKU-001', productName: 'Product A', variantInfo: 'Size 7' },
      ]);
      expect(html).toContain('@media print');
      expect(html).toContain('@page');
      expect(html).toContain('50mm');
      expect(html).toContain('25mm');
    });

    it('should handle an empty items array', async () => {
      const { generateBatchLabelsHtml } = await import('../../lib/barcode');
      const html = generateBatchLabelsHtml([]);
      expect(html).toContain('<!DOCTYPE html>');
      const labelCount = (html.match(/class="barcode-label"/g) || []).length;
      expect(labelCount).toBe(0);
    });

    it('should contain all SKUs from the input', async () => {
      const { generateBatchLabelsHtml } = await import('../../lib/barcode');
      const items = [
        { sku: 'ALPHA-01', productName: 'Alpha', variantInfo: 'S' },
        { sku: 'BETA-02', productName: 'Beta', variantInfo: 'M' },
      ];
      const html = generateBatchLabelsHtml(items);
      expect(html).toContain('ALPHA-01');
      expect(html).toContain('BETA-02');
    });
  });

  describe('triggerPrint', () => {
    it('should open a new window and call print', async () => {
      const mockDoc = {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };
      const mockWindow = {
        document: mockDoc,
        focus: vi.fn(),
        print: vi.fn(),
        close: vi.fn(),
        onload: null as (() => void) | null,
      };

      (globalThis as any).window = {
        open: vi.fn(() => mockWindow),
      };

      const { triggerPrint } = await import('../../lib/barcode');
      const testHtml = '<html><body>Test</body></html>';
      triggerPrint(testHtml);

      expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=600,height=400');
      expect(mockDoc.open).toHaveBeenCalled();
      expect(mockDoc.write).toHaveBeenCalledWith(testHtml);
      expect(mockDoc.close).toHaveBeenCalled();

      // Simulate onload
      if (mockWindow.onload) {
        mockWindow.onload();
        expect(mockWindow.focus).toHaveBeenCalled();
        expect(mockWindow.print).toHaveBeenCalled();
        expect(mockWindow.close).toHaveBeenCalled();
      }
    });

    it('should throw if window.open returns null', async () => {
      (globalThis as any).window = {
        open: vi.fn(() => null),
      };

      const { triggerPrint } = await import('../../lib/barcode');
      expect(() => triggerPrint('<html></html>')).toThrow('Unable to open print window');
    });
  });
});
