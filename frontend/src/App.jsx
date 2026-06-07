import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabase'
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

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
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
            <Route path="/exams" element={<Exams />} />
            <Route path="/students" element={<Students />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/results" element={<Results />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={<Navigate to={session ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
