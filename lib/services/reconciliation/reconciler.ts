import { eq, between } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payments, reconciliations } from '@/lib/db/schema'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BankRecord {
  transactionId: string
  amount: number          // dollar value, e.g. 19.99
  currency: string
  valueDate: string       // ISO date string from bank, e.g. "2026-01-15T14:30:00"
  description: string
  reference: string
}

export interface Payment {
  id: string
  externalRef: string
  amount: number          // dollar value, e.g. 19.99
  currency: string
  createdAt: Date
  status: 'pending' | 'cleared' | 'reconciled' | 'disputed'
}

export interface ReconciliationResult {
  id: string
  matched: MatchedPair[]
  unmatched: { bankOnly: BankRecord[]; systemOnly: Payment[] }
  discrepancies: Discrepancy[]
  summary: {
    totalBankAmount: number
    totalSystemAmount: number
    difference: number
  }
}

export interface MatchedPair {
  bankRecord: BankRecord
  payment: Payment
}

export interface Discrepancy {
  bankRecord: BankRecord
  payment: Payment
  amountDelta: number
}

const toCents = (amount: number): number => Math.round(amount * 100)

const normalizeRef = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase()

function refsMatch(bankRecord: BankRecord, payment: Payment): boolean {
  const paymentRef = normalizeRef(payment.externalRef)
  const bankReference = normalizeRef(bankRecord.reference)
  const bankTransactionId = normalizeRef(bankRecord.transactionId)

  if (!paymentRef) return false
  return paymentRef === bankReference || paymentRef === bankTransactionId
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Finds the best matching internal payment for a given bank record.
 * Matching strategy: exact match on reference/transaction id + currency + amount.
 * This intentionally models an inner-join style "common key" match and excludes non-common rows.
 */
function findMatch(bankRecord: BankRecord, candidates: Payment[]): Payment | undefined {
  const bankCents = toCents(bankRecord.amount)
  return candidates.find(
    p =>
      refsMatch(bankRecord, p) &&
      p.currency === bankRecord.currency &&
      toCents(p.amount) === bankCents,
  )
}

/**
 * Checks whether a date falls within the reporting period.
 */
function isInPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
  return date >= periodStart && date < periodEnd
}

/**
 * Parses a bank-supplied date string into a Date object.
 */
function parseBankDate(isoString: string): Date {
  return new Date(isoString)
}

/**
 * Calculates the monetary discrepancy between a bank record and a payment.
 */
function calculateDelta(bankAmount: number, systemAmount: number): number {
  return bankAmount - systemAmount
}

/**
 * Marks a payment as reconciled.
 */
async function markReconciled(paymentId: string): Promise<void> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))

  if (payment && payment.status === 'pending') {
    await db
      .update(payments)
      .set({ status: 'reconciled' })
      .where(eq(payments.id, paymentId))
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function reconcilePayments(
  // Requirement trace: batch of bank records (JSON converted from CSV import).
  bankData: BankRecord[],
  periodStart: Date,
  periodEnd: Date,
): Promise<ReconciliationResult> {
  const systemPayments = (await db
    .select()
    .from(payments)
    .where(between(payments.createdAt, periodStart, periodEnd))) as Payment[]

  const matched: MatchedPair[] = []
  const discrepancies: Discrepancy[] = []
  const matchedPaymentIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  const inPeriodBankData = bankData.filter(record => {
    const bankDate = parseBankDate(record.valueDate)
    return isInPeriod(bankDate, periodStart, periodEnd)
  })

  for (const bankRecord of inPeriodBankData) {
    const remaining = systemPayments.filter((p: Payment) => !matchedPaymentIds.has(p.id))
    const match = findMatch(bankRecord, remaining)

    if (match) {
      matched.push({ bankRecord, payment: match })
      matchedPaymentIds.add(match.id)
      matchedBankIds.add(bankRecord.transactionId)
      await markReconciled(match.id)
      continue
    }

    const refCandidate = remaining.find(
      (p: Payment) => refsMatch(bankRecord, p) && p.currency === bankRecord.currency,
    )
    if (refCandidate) {
      discrepancies.push({
        bankRecord,
        payment: refCandidate,
        amountDelta: calculateDelta(bankRecord.amount, refCandidate.amount),
      })
    }
  }

  const totalBankAmountCents = inPeriodBankData.reduce((sum, r) => sum + toCents(r.amount), 0)
  const totalSystemAmountCents = systemPayments.reduce(
    (sum: number, p: Payment) => sum + toCents(p.amount),
    0,
  )
  const totalBankAmount = totalBankAmountCents / 100
  const totalSystemAmount = totalSystemAmountCents / 100
  const difference = calculateDelta(totalBankAmount, totalSystemAmount)

  const bankOnly = inPeriodBankData.filter(r => !matchedBankIds.has(r.transactionId))
  const systemOnly = systemPayments.filter((p: Payment) => !matchedPaymentIds.has(p.id))

  const [saved] = await db
    .insert(reconciliations)
    .values({
      periodStart,
      periodEnd,
      matchedCount: matched.length,
      unmatchedCount: bankOnly.length + systemOnly.length,
      totalBankAmount,
      totalSystemAmount,
      difference,
      status: 'complete',
    })
    .returning()

  return {
    id: saved.id,
    matched,
    unmatched: { bankOnly, systemOnly },
    discrepancies,
    summary: { totalBankAmount, totalSystemAmount, difference },
  }
}
