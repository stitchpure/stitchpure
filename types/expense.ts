export type ExpenseCategory = 'MATERIAL' | 'LABOUR' | 'PACKAGING' | 'OVERHEAD' | 'TRANSPORT' | 'OTHER';

export interface Expense {
  id: string;
  companyId: string;
  productionBatchId: string | null;
  name: string;
  amount: string;
  category: ExpenseCategory;
  expenseDate: string;
  notes: string | null;
  includeInManufacturingCost: boolean;
  createdAt: string;
  updatedAt: string;
}
