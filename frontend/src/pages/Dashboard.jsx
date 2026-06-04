import { supabase } from '../supabase'

const NAV_ITEMS = ['Dashboard', 'Subjects', 'Exams', 'Students', 'Results']

const STATS = [
  { label: 'Total Subjects', value: 0 },
  { label: 'Total Exams', value: 0 },
  { label: 'Total Students', value: 0 },
]

export default function Dashboard({ session }) {
  const email = session.user.email

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-gray-900">EduPulse</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-52 bg-white border-r border-gray-200 shrink-0 py-4">
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  item === 'Dashboard'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-8 overflow-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Welcome, {email}
          </h1>

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
        </main>
      </div>
    </div>
  )
}
