import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useTheme } from '../context/ThemeContext'

const studentNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Results', to: '/results' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Announcements', to: '/announcements' },
  { label: 'Fee Payment', to: '/fees' },
  { label: 'Profile', to: '/profile' },
]

const teacherNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Exams', to: '/exams' },
  { label: 'Grading', to: '/scan' },
  { label: 'Students', to: '/students' },
  { label: 'Results', to: '/results' },
  { label: 'Announcements', to: '/announcements' },
  { label: 'Profile', to: '/profile' },
]

const adminNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Classes', to: '/classes' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Teachers', to: '/teachers' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Exams', to: '/exams' },
  { label: 'Grading', to: '/scan' },
  { label: 'Students', to: '/students' },
  { label: 'Results', to: '/results' },
  { label: 'Announcements', to: '/announcements' },
  { label: 'Admin', to: '/admin' },
  { label: 'Fee Management', to: '/fees' },
  { label: 'Profile', to: '/profile' },
]

function getInstituteDisplayName(institute) {
  if (!institute) return 'EduPulse'
  if (institute.brand_name?.trim()) return institute.brand_name.trim()
  const words = (institute.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0]} ${words[1]}`
  if (words.length === 1) return words[0]
  return 'EduPulse'
}

function getLogoLetter(institute) {
  const source = institute?.brand_name?.trim() || institute?.name?.trim() || 'EduPulse'
  return source.charAt(0).toUpperCase()
}

export default function AppLayout({ session }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const notifRef = useRef(null)
  const [displayName, setDisplayName] = useState('')
  const [userRole, setUserRole] = useState('student')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [instituteBranding, setInstituteBranding] = useState(null)

  const brandingTitle = getInstituteDisplayName(instituteBranding)
  const logoLetter = getLogoLetter(instituteBranding)

  useEffect(() => {
    if (!session?.user?.id) {
      setInstituteBranding(null)
      document.title = 'EduPulse'
      return
    }

    supabase
      .from('users')
      .select('is_active, role, name, institute_id, institutes(name, brand_name, logo_url)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data?.is_active === false) {
          localStorage.setItem('blocked_message',
            'Your account has been temporarily blocked. Please contact your institute admin or help desk for assistance.')
          await supabase.auth.signOut()
          return
        }
        if (data) {
          setDisplayName(data.name || session.user.email)
          setUserRole(data.role)
          setInstituteBranding(data.institutes ?? null)
        } else {
          setInstituteBranding(null)
        }
      })
  }, [session])

  useEffect(() => {
    document.title = brandingTitle
    return () => {
      document.title = 'EduPulse'
    }
  }, [brandingTitle])

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
    userRole === 'student' || userRole === 'parent'
      ? studentNav
      : userRole === 'admin'
        ? adminNav
        : teacherNav

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex flex-col">
      <header className="bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-gray-700 h-14 flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
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
            {instituteBranding?.logo_url ? (
              <img
                src={instituteBranding.logo_url}
                alt={brandingTitle}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">{logoLetter}</span>
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">{brandingTitle}</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="text-sm text-gray-600 dark:text-[#A8A8A8] hover:text-gray-900 dark:hover:text-[#FFFFFF] font-medium cursor-pointer"
          >
            {displayName}
          </button>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 text-gray-600 dark:text-[#A8A8A8] hover:text-gray-900 dark:hover:text-[#FFFFFF] hover:bg-gray-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
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
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full border border-current flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="fixed right-2 top-14 w-[calc(100vw-16px)] md:absolute md:right-0 md:top-full md:mt-1 md:w-80 bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Notifications</p>
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
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8] text-center py-6">No notifications yet</p>
                )}

                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors ${
                          !n.is_read ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      >
                        <p
                          className={`text-sm font-medium ${
                            !n.is_read ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-600 dark:text-[#A8A8A8]'
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-1">
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
            className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] hover:text-gray-900 dark:hover:text-[#FFFFFF] border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[#262626] hover:shadow-md transition-shadow"
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
          className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#000000] border-r-2 border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out flex flex-col md:relative md:translate-x-0 md:w-52 md:flex md:flex-col shrink-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 md:hidden border-b-2 border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">Menu</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-[#A8A8A8]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 overflow-y-auto">
            {navItems.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-left text-sm px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === to
                    ? 'border-l-4 border-blue-500 bg-blue-50 dark:bg-[#262626] text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-100 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-[#FFFFFF]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t-2 border-gray-200 dark:border-gray-700 px-3 py-3">
            <div className="flex items-center gap-3 w-full">
              <span className="text-base shrink-0" aria-hidden="true">
                {theme === 'dark' ? '☀️' : '🌙'}
              </span>
              <span className="flex-1 text-sm text-gray-700 dark:text-[#A8A8A8]">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                onClick={toggleTheme}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                  theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-[#363636]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    theme === 'dark' ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
          <Outlet context={{ session }} />
        </main>
      </div>
    </div>
  )
}
