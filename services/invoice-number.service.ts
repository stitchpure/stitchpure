/**
 * Invoice Number Service
 *
 * Handles concurrency-safe sequential invoice number assignment.
 * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) to prevent
 * duplicate sequence numbers under concurrent requests.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { pool } from "@/db";
import { getFinancialYear, formatInvoiceNumber } from "@/lib/invoice-utils";
import { ServiceError } from "@/lib/service-error";

export interface AssignInvoiceNumberResult {
  invoiceNumber: string;
  isNew: boolean;
}

/**
 * Get or assign an invoice number for a sale.
 *
 * - If the sale already has an invoice record, return existing number (idempotent).
 * - Otherwise, atomically increment the sequence for the company+FY and create invoice record.
 *
 * Uses SELECT ... FOR UPDATE on invoice_number_sequences for concurrency safety.
 */
export async function assignInvoiceNumber(
  companyId: string,
  saleId: string,
  saleDate: Date
): Promise<AssignInvoiceNumberResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if sale already has an invoice record (idempotent)
    const existingResult = await client.query(
      `SELECT invoice_number FROM invoices WHERE sale_id = $1 AND company_id = $2 LIMIT 1`,
      [saleId, companyId]
    );

    if (existingResult.rows.length > 0) {
      await client.query("COMMIT");
      return {
        invoiceNumber: existingResult.rows[0].invoice_number,
        isNew: false,
      };
    }

    // 2. Determine financial year from sale date
    const financialYear = getFinancialYear(saleDate);

    // 3. Lock the sequence row for this company + FY (or create if not exists)
    const seqResult = await client.query(
      `SELECT id, last_sequence FROM invoice_number_sequences
       WHERE company_id = $1 AND financial_year = $2
       FOR UPDATE`,
      [companyId, financialYear]
    );

    let nextSequence: number;

    if (seqResult.rows.length === 0) {
      // No sequence row exists — create one with lastSequence = 1
      nextSequence = 1;
      await client.query(
        `INSERT INTO invoice_number_sequences (company_id, financial_year, last_sequence, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [companyId, financialYear, nextSequence]
      );
    } else {
      // Increment the existing sequence
      nextSequence = seqResult.rows[0].last_sequence + 1;
      await client.query(
        `UPDATE invoice_number_sequences
         SET last_sequence = $1, updated_at = NOW()
         WHERE id = $2`,
        [nextSequence, seqResult.rows[0].id]
      );
    }

    // 4. Format the invoice number
    const invoiceNumber = formatInvoiceNumber(financialYear, nextSequence);

    // 5. Create the invoice record
    await client.query(
      `INSERT INTO invoices (company_id, sale_id, invoice_number, financial_year, sequence_number, status, generated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW(), NOW())`,
      [companyId, saleId, invoiceNumber, financialYear, nextSequence]
    );

    await client.query("COMMIT");

    return {
      invoiceNumber,
      isNew: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      // Race condition: another request created the invoice for this sale
      // Retry by reading the existing record
      const retryResult = await client.query(
        `SELECT invoice_number FROM invoices WHERE sale_id = $1 AND company_id = $2 LIMIT 1`,
        [saleId, companyId]
      );

      if (retryResult.rows.length > 0) {
        return {
          invoiceNumber: retryResult.rows[0].invoice_number,
          isNew: false,
        };
      }
    }

    throw new ServiceError(
      "Unable to generate invoice number, please retry",
      500
    );
  } finally {
    client.release();
  }
}
