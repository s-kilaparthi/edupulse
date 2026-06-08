import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const notifRef = useRef(null)
  const [displayName, setDisplayName] = useState('')
  const [userRole, setUserRole] = useState('student')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)

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

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter((n) => !n.is_read).length)
        }
      })
  }, [session])

  useEffect(() => {
    if (!showNotifDropdown) return

    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifDropdown])

  async function markAllRead() {
    if (!session?.user?.id) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function handleNotifClick(notification) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))

    if (notification.type === 'results') {
      navigate('/results')
    }

    setShowNotifDropdown(false)
  }

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
          <span className="text-sm text-gray-600">{displayName}</span>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No notifications yet</p>
                )}

                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          !n.is_read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p
                          className={`text-sm font-medium ${
                            !n.is_read ? 'text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

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
