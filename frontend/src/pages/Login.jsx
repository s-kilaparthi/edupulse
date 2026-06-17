import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Login() {
  const navigate = useNavigate()
  const [loginMode, setLoginMode] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [instituteCode, setInstituteCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const blocked = localStorage.getItem('blocked_message')
    if (blocked) {
      setError(blocked)
      localStorage.removeItem('blocked_message')
    }
  }, [])

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
        localStorage.setItem('blocked_message',
          'Your account has been temporarily blocked. Please contact your institute admin or help desk for assistance.')
        await supabase.auth.signOut()
        return
      }

      setLoading(false)
      navigate('/dashboard', { replace: true })
      return
    }

    if (loginMode === 'parent') {
      const { data: parentData } = await supabase
        .from('users')
        .select('email')
        .eq('parent_phone', parentPhone.trim())
        .eq('role', 'parent')
        .limit(1)
        .maybeSingle()

      if (!parentData) {
        setError('No parent account found for this phone number')
        setLoading(false)
        return
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: parentData.email,
        password: password,
      })

      if (signInError) {
        setLoading(false)
        setError('Invalid phone number or password.')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('is_active, role')
        .eq('id', authData.user.id)
        .single()

      if (userData?.is_active === false) {
        localStorage.setItem('blocked_message',
          'Your account has been temporarily blocked. Please contact your institute admin or help desk for assistance.')
        await supabase.auth.signOut()
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
      localStorage.setItem('blocked_message',
        'Your account has been temporarily blocked. Please contact your institute admin or help desk for assistance.')
      await supabase.auth.signOut()
      return
    }

    setLoading(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/icon-512.png"
            width="48"
            height="48"
            className="rounded-xl object-cover mx-auto mb-4"
            alt="WoodenScale"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">WoodenScale</h1>
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="flex rounded-lg border-2 border-gray-200 dark:border-gray-700 p-1 mb-6">
          <button
            type="button"
            onClick={() => setLoginMode('email')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              loginMode === 'email'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]'
            }`}
          >
            Teacher
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('student')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              loginMode === 'student'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('parent')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              loginMode === 'parent'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]'
            }`}
          >
            Parent
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {loginMode === 'email' ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                placeholder="you@example.com"
              />
            </div>
          ) : loginMode === 'student' ? (
            <div>
              <label htmlFor="roll-number" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Roll number
              </label>
              <input
                id="roll-number"
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                placeholder="Your roll number e.g. 007"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="parent-phone" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Phone number
              </label>
              <input
                id="parent-phone"
                type="text"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                maxLength={10}
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                placeholder="Registered phone number"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
              placeholder={loginMode === 'parent' ? 'Student roll number' : '••••••••'}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-[#A8A8A8]">
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
