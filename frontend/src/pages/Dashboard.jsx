import { useOutletContext } from 'react-router-dom'

const STATS = [
  { label: 'Total Subjects', value: 0 },
  { label: 'Total Exams', value: 0 },
  { label: 'Total Students', value: 0 },
]

export default function Dashboard() {
  const { session } = useOutletContext()
  const email = session.user.email

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Welcome, {email}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </>
  )
}
