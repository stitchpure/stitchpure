export type BatchStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ProductionBatch {
  id: string;
  companyId: string;
  batchNumber: string;
  productId: string;
  productItemId: string | null;
  status: BatchStatus;
  plannedQuantity: number;
  producedQuantity: number;
  goodQuantity: number;
  rejectedQuantity: number;
  startDate: string;
  completionDate: string | null;
  materialCost: string | null;
  labourCost: string | null;
  packagingCost: string | null;
  overheadCost: string | null;
  transportCost: string | null;
  otherCost: string | null;
  totalManufacturingCost: string | null;
  costPerUnit: string | null;
  materialCostPerUnit: string | null;
  labourCostPerUnit: string | null;
  packagingCostPerUnit: string | null;
  overheadCostPerUnit: string | null;
  transportCostPerUnit: string | null;
  otherCostPerUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended batch type with joined product info for list display.
 * Used when the API returns product name/SKU alongside batch data.
 */
export interface ProductionBatchWithProduct extends ProductionBatch {
  productName: string;
  skuCode: string | null;
}
