import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

const studentNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Results', to: '/results' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Announcements', to: '/announcements' },
]

const teacherNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
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
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-gray-900">EduPulse</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{displayName}</span>
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
            {navItems.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
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

        <main className="flex-1 p-8 overflow-auto">
          <Outlet context={{ session }} />
        </main>
      </div>
    </div>
  )
}
