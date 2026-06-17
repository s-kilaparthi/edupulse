import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeProvider } from './context/ThemeContext'
import Loader from './components/Loader'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Subjects from './pages/Subjects'
import Exams from './pages/Exams'
import Students from './pages/Students'
import Scan from './pages/Scan'
import Results from './pages/Results'
import Admin from './pages/Admin'
import Announcements from './pages/Announcements'
import Classes from './pages/Classes'
import Teachers from './pages/Teachers'
import Schedule from './pages/Schedule'
import Attendance from './pages/Attendance'
import Profile from './pages/Profile'
import FeePayment from './pages/FeePayment'
import SuperAdminLogin from './pages/SuperAdminLogin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'

function SplashScreen({ fadingOut }) {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex min-h-screen flex-col items-center justify-center bg-white transition-opacity duration-500 ${
        fadingOut ? 'splash-fade-out opacity-0' : 'splash-fade-in opacity-100'
      }`}
    >
      <img
        src="/icon-512.png"
        alt="WoodenScale"
        width={120}
        height={120}
        className="h-[120px] w-[120px] object-contain"
      />
      <h1 className="mt-6 text-3xl font-bold text-[#1E3A8A]">WoodenScale</h1>
      <p className="mt-2 text-sm text-gray-500">Smart Class Management</p>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(() => sessionStorage.getItem('splash-shown') !== 'true')
  const [splashFadingOut, setSplashFadingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('splash-shown') === 'true') return

    const fadeOutTimer = setTimeout(() => setSplashFadingOut(true), 2000)
    const hideTimer = setTimeout(() => {
      sessionStorage.setItem('splash-shown', 'true')
      setShowSplash(false)
    }, 2500)
    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (showSplash) {
    return <SplashScreen fadingOut={splashFadingOut} />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#000000]">
        <Loader size={80} />
      </div>
    )
  }

  return (
    <ThemeProvider session={session}>
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={session ? <Navigate to="/dashboard" replace /> : <Register />}
        />
        <Route element={<ProtectedRoute session={session} />}>
          <Route element={<AppLayout session={session} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/students" element={<Students />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/results" element={<Results />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/fees" element={<FeePayment />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route
          path="*"
          element={<Navigate to={session ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}
