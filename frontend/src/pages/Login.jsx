import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Login() {
  const navigate = useNavigate()
  const [loginMode, setLoginMode] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [instituteCode, setInstituteCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (loginMode === 'student') {
      const { data: studentData } = await supabase
        .from('users')
        .select('email, institute_id')
        .eq('roll_number', rollNumber.trim())
        .eq('role', 'student')
        .single()

      if (!studentData) {
        setError('Student not found. Check your roll number.')
        setLoading(false)
        return
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: studentData.email,
        password: password,
      })

      if (signInError) {
        setLoading(false)
        setError('Invalid roll number or password.')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('is_active, role')
        .eq('id', authData.user.id)
        .single()

      if (userData?.is_active === false) {
        await supabase.auth.signOut()
        setError('Your account has been disabled. Please contact your institute admin.')
        setLoading(false)
        return
      }

      setLoading(false)
      navigate('/dashboard', { replace: true })
      return
    }

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('is_active, role')
      .eq('id', authData.user.id)
      .single()

    if (userData?.is_active === false) {
      await supabase.auth.signOut()
      setError('Your account has been disabled. Please contact your institute admin.')
      setLoading(false)
      return
    }

    setLoading(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EduPulse</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="flex rounded-lg border border-gray-200 p-1 mb-6">
          <button
            type="button"
            onClick={() => setLoginMode('email')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              loginMode === 'email'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Teacher / Admin
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('student')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              loginMode === 'student'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Student
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {loginMode === 'email' ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="roll-number" className="block text-sm font-medium text-gray-700 mb-1">
                Roll number
              </label>
              <input
                id="roll-number"
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Your roll number e.g. 007"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-gray-500">
            New institute?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Register here
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
