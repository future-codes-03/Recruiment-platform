import { useEffect, useState } from 'react'
import Header from '../../components/employer/Header'
import { Card, Badge } from '../../components/shared'
import { getPaymentActivity } from '../../api/company'

const STATUS_VARIANT = {
  succeeded: 'success',
  pending: 'slate',
  failed: 'slate',
  refunded: 'slate',
}

function Billing() {
  const [payments, setPayments] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPaymentActivity()
      .then((data) => !cancelled && setPayments(data.results))
      .catch(() => !cancelled && setError("Couldn't load payment activity."))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Jobs" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-2">Payment activity</h1>
        <p className="text-sm text-slate mb-8">
          Candidates pay a small fee per assessment attempt — your company isn't billed.
          This is a read-only view of that activity across your jobs.
        </p>

        {error && <Card className="mb-6 text-danger text-sm">{error}</Card>}

        {payments === null && !error && (
          <p className="text-sm text-slate">Loading...</p>
        )}

        {payments?.length === 0 && (
          <Card className="text-sm text-slate">No payment activity yet.</Card>
        )}

        {payments?.length > 0 && (
          <Card padded={false} className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-4 px-5 py-3 border-b border-slate/15">
                <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">Candidate</span>
                <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">Date</span>
                <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">Amount</span>
                <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold text-right">Status</span>
              </div>
              {payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className={`grid grid-cols-4 px-5 py-3 items-center ${
                    index !== payments.length - 1 ? 'border-b border-slate/10' : ''
                  }`}
                >
                  <span className="text-sm text-ink truncate pr-2">{payment.candidate_name}</span>
                  <span className="text-sm text-ink whitespace-nowrap">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-sm text-ink whitespace-nowrap">
                    {payment.amount} {payment.currency}
                  </span>
                  <span className="text-right">
                    <Badge variant={STATUS_VARIANT[payment.status] ?? 'slate'}>{payment.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Billing
