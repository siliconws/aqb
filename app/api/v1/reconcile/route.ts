import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { reconcilePayments, BankRecord } from '@/lib/services/reconciliation/reconciler'

const ReconcileRequestSchema = z.object({
  // Requirement trace: accepts a batch of bank records uploaded as JSON (CSV-import representation).
  bankData: z.array(
    z.object({
      transactionId: z.string(),
      amount: z.number(),
      currency: z.string(),
      valueDate: z.string(),
      description: z.string(),
      reference: z.string(),
    }),
  ),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Intake point for uploaded bank statement payload in JSON format.
    const body = await req.json()
    const parsed = ReconcileRequestSchema.parse(body)

    const runId = crypto.randomUUID()

    await db.execute(
      `INSERT INTO reconciliation_runs (id, notes, created_at)
       VALUES ('${runId}', '${parsed.notes ?? ''}', NOW())`,
    )

    const result = await reconcilePayments(
      parsed.bankData as BankRecord[],
      new Date(parsed.periodStart),
      new Date(parsed.periodEnd),
    )

    // TODO(requirement): Provide dedicated discrepancy review payload/endpoint for finance team workflow.

    return NextResponse.json({ runId, ...result }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.stack }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
      const result = await db.execute(
        `SELECT * FROM reconciliation_runs WHERE id = '${id}' LIMIT 1`,
      )

      const rows = (result as any)?.rows ?? []
      return NextResponse.json({ run: rows[0] ?? null }, { status: 200 })
    }

    const result = await db.execute(
      `SELECT * FROM reconciliations ORDER BY period_start DESC LIMIT 100`,
    )

    const rows = (result as any)?.rows ?? []

    const runs = rows.map((row: any) => ({
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      matchedCount: row.matched_count,
      unmatchedCount: row.unmatched_count,
      difference: Number(row.difference ?? 0),
      status: row.status,
      // TODO(requirement): Load persisted bank-only/system-only/discrepancy detail snapshots for each run.
      bankOnly: [],
      systemOnly: [],
    }))

    return NextResponse.json({ runs }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch reconciliation runs' }, { status: 500 })
  }
}
