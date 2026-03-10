'use client'

import { useState, useEffect } from 'react'
import { Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ReconciliationRun {
  id: string
  periodStart: string
  periodEnd: string
  matchedCount: number
  unmatchedCount: number
  difference: number
  status: 'pending' | 'running' | 'complete' | 'failed'
  bankOnly?: Array<{ transactionId: string; amount: number; reference: string }>
  systemOnly?: Array<{ id: string; amount: number; externalRef: string }>
}

export function ReconciliationDashboard() {
  const [runs, setRuns] = useState<ReconciliationRun[]>([])
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const res = await fetch('/api/v1/reconcile')
        const data = await res.json()
        setRuns(data.runs ?? [])
      } catch {
        // silent
      }
    }

    void loadRuns()

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/reconcile')
        const data = await res.json()
        setRuns(data.runs ?? [])
      } catch {
        // silent
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const badgeClass: Record<ReconciliationRun['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  const toggleExpand = (runId: string) => {
    setExpandedRunIds((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Matched</TableHead>
                <TableHead>Unmatched</TableHead>
                <TableHead>Missing in Local DB</TableHead>
                <TableHead>Missing in Bank</TableHead>
                <TableHead>Discrepancy</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run: ReconciliationRun) => {
                const bankOnlyCount = run.bankOnly?.length ?? 0
                const systemOnlyCount = run.systemOnly?.length ?? 0
                const isExpanded = expandedRunIds.has(run.id)

                // TODO(requirement): Add discrepancy review section per run once discrepancy details are returned by API.

                return (
                  <Fragment key={run.id}>
                    <TableRow key={run.id}>
                      <TableCell>
                        {run.periodStart} – {run.periodEnd}
                      </TableCell>
                      <TableCell>{run.matchedCount}</TableCell>
                      <TableCell>{run.unmatchedCount}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => toggleExpand(run.id)}
                          title="Show transactions present in bank but missing in local DB"
                        >
                          {bankOnlyCount}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => toggleExpand(run.id)}
                          title="Show transactions present in local DB but missing in bank"
                        >
                          {systemOnlyCount}
                        </button>
                      </TableCell>
                      <TableCell>{formatAmount(run.difference)}</TableCell>
                      <TableCell>
                        <Badge className={badgeClass[run.status]}>{run.status}</Badge>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${run.id}-details`}>
                        <TableCell colSpan={7}>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-md border p-3">
                              <p className="text-sm font-medium">Missing in Local DB (Bank Only)</p>
                              {bankOnlyCount === 0 ? (
                                <p className="text-xs text-muted-foreground mt-2">No missing transactions.</p>
                              ) : (
                                <ul className="mt-2 space-y-1 text-xs">
                                  {run.bankOnly?.map((item: { transactionId: string; amount: number; reference: string }) => (
                                    <li key={item.transactionId}>
                                      {item.transactionId} · {formatAmount(item.amount)} · {item.reference}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="rounded-md border p-3">
                              <p className="text-sm font-medium">Missing in Bank (Local Only)</p>
                              {systemOnlyCount === 0 ? (
                                <p className="text-xs text-muted-foreground mt-2">No missing transactions.</p>
                              ) : (
                                <ul className="mt-2 space-y-1 text-xs">
                                  {run.systemOnly?.map((item: { id: string; amount: number; externalRef: string }) => (
                                    <li key={item.id}>
                                      {item.id} · {formatAmount(item.amount)} · {item.externalRef}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
