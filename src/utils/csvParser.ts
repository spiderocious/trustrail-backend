import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { parseCSVDate } from './dateUtils';

export interface Transaction {
  date: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface CSVRow {
  [key: string]: string;
}

/**
 * Parse bank statement CSV from buffer
 * Accepts CSV content as Buffer or string and processes in memory
 */
export const parseBankStatementCSV = (csvContent: Buffer | string): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const transactions: Transaction[] = [];
    const errors: string[] = [];

    // Convert buffer to string if needed
    const csvString = Buffer.isBuffer(csvContent) ? csvContent.toString('utf-8') : csvContent;

    // Create readable stream from string
    const stream = Readable.from([csvString]);

    stream
      .pipe(csvParser())
      .on('data', (row: CSVRow) => {
        try {
          const transaction = parseTransactionRow(row);
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          errors.push(`Error parsing row: ${error}`);
        }
      })
      .on('end', () => {
        if (transactions.length === 0) {
          reject(new Error('No valid transactions found in CSV'));
          return;
        }

        // Sort transactions by date (oldest first)
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Fill missing balances if needed
        fillMissingBalances(transactions);

        resolve(transactions);
      })
      .on('error', (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      });
  });
};

/**
 * Parse a single transaction row from CSV
 * Handles various CSV formats from different Nigerian banks
 */
const parseTransactionRow = (row: CSVRow): Transaction | null => {
  // Detect column names (case-insensitive, flexible)
  const dateCol = findColumn(row, ['date', 'trans date', 'transaction date', 'value date', 'posting date']);
  const descCol = findColumn(row, ['description', 'narration', 'remarks', 'details', 'transaction details']);
  const debitCol = findColumn(row, ['debit', 'debit amount', 'withdrawal', 'dr']);
  const creditCol = findColumn(row, ['credit', 'credit amount', 'deposit', 'cr']);
  const balanceCol = findColumn(row, ['balance', 'running balance', 'available balance', 'bal']);

  if (!dateCol || !descCol) {
    return null; // Skip rows without date or description
  }

  // Parse date
  const date = parseCSVDate(row[dateCol]);
  if (!date) {
    return null; // Skip invalid dates
  }

  // Parse amounts (handle empty strings, commas, currency symbols)
  const debit = parseAmount(debitCol ? row[debitCol] || '0' : '0');
  const credit = parseAmount(creditCol ? row[creditCol] || '0' : '0');
  const balance = parseAmount(balanceCol ? row[balanceCol] || '0' : '0');

  return {
    date,
    description: row[descCol].trim(),
    debit,
    credit,
    balance,
  };
};

/**
 * Find column name (case-insensitive)
 */
const findColumn = (row: CSVRow, possibleNames: string[]): string | null => {
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const found = keys.find((key) => key.toLowerCase().trim() === name.toLowerCase());
    if (found) return found;
  }
  return null;
};

/**
 * Parse amount from string (handle commas, currency symbols)
 */
const parseAmount = (value: string): number => {
  if (!value || value.trim() === '') return 0;

  // Remove currency symbols, commas, and spaces
  const cleaned = value
    .replace(/[₦$,\s]/g, '')
    .trim();

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
};

/**
 * Fill missing balances by calculating from credits and debits
 */
const fillMissingBalances = (transactions: Transaction[]): void => {
  let hasAnyBalance = false;

  // Check if we have any balance values
  for (const tx of transactions) {
    if (tx.balance !== 0) {
      hasAnyBalance = true;
      break;
    }
  }

  // If we have at least one balance, use it as starting point
  if (hasAnyBalance) {
    // Find first transaction with balance
    let firstBalanceIndex = transactions.findIndex(tx => tx.balance !== 0);

    // Calculate backwards from first known balance
    for (let i = firstBalanceIndex - 1; i >= 0; i--) {
      const tx = transactions[i];
      const nextTx = transactions[i + 1];
      tx.balance = nextTx.balance - tx.credit + tx.debit;
    }

    // Calculate forwards from last known balance
    for (let i = firstBalanceIndex + 1; i < transactions.length; i++) {
      const tx = transactions[i];
      const prevTx = transactions[i - 1];
      if (tx.balance === 0) {
        tx.balance = prevTx.balance + tx.credit - tx.debit;
      }
    }
  } else {
    // No balance column - calculate from scratch (assume starting balance = 0)
    let balance = 0;
    for (const tx of transactions) {
      balance = balance + tx.credit - tx.debit;
      tx.balance = balance;
    }
  }
};

/**
 * Validate CSV content before parsing
 */
export const validateCSVContent = (csvContent: Buffer | string): { valid: boolean; error?: string } => {
  const content = Buffer.isBuffer(csvContent) ? csvContent.toString('utf-8') : csvContent;

  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'CSV content is empty' };
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    return { valid: false, error: 'CSV must contain at least a header row and one data row' };
  }

  return { valid: true };
};

export default {
  parseBankStatementCSV,
  validateCSVContent,
};
