import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeProvider } from './context/ThemeContext'
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
      className={`fixed inset-0 z-[9999] flex min-h-screen flex-col items-center justify-center bg-white ${
        fadingOut ? 'splash-fade-out' : 'splash-fade-in'
      }`}
    >
      <img
        src="/splash-screen.png"
        alt="WoodenScale"
        width={250}
        height={250}
        className="h-[250px] w-[250px] object-contain"
      />
      <h1 className="mt-6 text-2xl font-bold text-blue-900">WoodenScale</h1>
      <p className="mt-2 text-sm text-gray-500">Smart Class Management</p>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
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
    const fadeOutTimer = setTimeout(() => setSplashFadingOut(true), 2000)
    const hideTimer = setTimeout(() => setShowSplash(false), 2500)
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center">
        <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">Loading…</p>
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
