import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

const STUDENT_FEATURES = [
  'Pay fees online via UPI, Net Banking, Card',
  'View payment history and receipts',
  'Get payment reminders and due date alerts',
  'Download fee receipts instantly',
]

const ADMIN_FEATURES = [
  'Set fee structure per class/student',
  'Track payment status (paid/pending/overdue)',
  'Send automated payment reminders to parents',
  'Generate and share fee receipts',
  'View payment analytics and reports',
  'Accept online payments via UPI, Net Banking, Card',
]

function FeatureList({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="text-green-500 shrink-0 mt-0.5" aria-hidden="true">✓</span>
          <span className="text-sm text-gray-600 dark:text-[#A8A8A8]">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function FeePayment() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('')
  const [instituteName, setInstituteName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    supabase
      .from('users')
      .select('role, institutes(name)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role ?? '')
          setInstituteName(data.institutes?.name ?? '')
        }
        setLoading(false)
      })
  }, [session])

  const isAdmin = userRole === 'admin'

  if (loading) {
    return (
      <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Loading…</p>
    )
  }

  if (isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">EduPulse</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">Fee Management</h1>
        </header>

        <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-sm">
          <span className="text-4xl" aria-hidden="true">💰</span>
          <h2 className="text-xl font-bold mt-4">Fee Management — Coming Soon</h2>
          <p className="text-green-50 text-sm mt-2">
            Manage fee collection, track payments, and send reminders from one place.
          </p>
        </div>

        <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">What&apos;s coming</h3>
          <FeatureList items={ADMIN_FEATURES} />
        </div>

        <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#262626] p-5">
          <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">
            Fee management feature is under development. We&apos;ll notify you when it&apos;s ready.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">Fee Payment</h1>
      </header>

      <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-sm">
        <span className="text-4xl" aria-hidden="true">💳</span>
        <h2 className="text-xl font-bold mt-4">Online Fee Payment — Coming Soon</h2>
        <p className="text-blue-50 text-sm mt-2">
          Pay your fees securely from the app. No more cash or manual transfers.
        </p>
      </div>

      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">What&apos;s coming</h3>
        <FeatureList items={STUDENT_FEATURES} />
      </div>

      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#262626] p-5">
        <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">
          For now, please contact your institute for payment details
          {instituteName ? (
            <>
              {' — '}
              <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">{instituteName}</span>
            </>
          ) : (
            '.'
          )}
        </p>
      </div>
    </div>
  )
}
