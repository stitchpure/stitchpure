export type CostSheetStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ProductCostSheet {
  id: string;
  productId: string;
  productItemId: string | null;
  productionBatchId: string;
  effectiveDate: string;
  materialCostPerUnit: string;
  labourCostPerUnit: string;
  packagingCostPerUnit: string;
  overheadCostPerUnit: string;
  transportCostPerUnit: string;
  otherCostPerUnit: string;
  totalManufacturingCostPerUnit: string;
  status: CostSheetStatus;
  createdAt: string;
  updatedAt: string;
}
