import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

const studentNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Results', to: '/results' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Announcements', to: '/announcements' },
]

const teacherNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Exams', to: '/exams' },
  { label: 'Scan', to: '/scan' },
  { label: 'Students', to: '/students' },
  { label: 'Results', to: '/results' },
  { label: 'Announcements', to: '/announcements' },
]

const adminNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Classes', to: '/classes' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Teachers', to: '/teachers' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Exams', to: '/exams' },
  { label: 'Scan', to: '/scan' },
  { label: 'Students', to: '/students' },
  { label: 'Results', to: '/results' },
  { label: 'Announcements', to: '/announcements' },
  { label: 'Admin', to: '/admin' },
]

export default function AppLayout({ session }) {
  const { pathname } = useLocation()
  const [displayName, setDisplayName] = useState('')
  const [userRole, setUserRole] = useState('student')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('name, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.name || session.user.email)
          setUserRole(data.role)
        }
      })
  }, [session])

  const navItems =
    userRole === 'student'
      ? studentNav
      : userRole === 'admin'
        ? adminNav
        : teacherNav

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-gray-900">EduPulse</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden md:block">{displayName}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-52 md:flex md:flex-col shrink-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 md:hidden border-b border-gray-100">
            <span className="font-semibold text-gray-900">Menu</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-0.5 px-3 py-4">
            {navItems.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-left text-sm px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === to
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
          <Outlet context={{ session }} />
        </main>
      </div>
    </div>
  )
}
