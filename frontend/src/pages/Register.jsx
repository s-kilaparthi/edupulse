import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Register() {
  const [instituteName, setInstituteName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (
      !instituteName.trim() ||
      !city.trim() ||
      !state.trim() ||
      !adminName.trim() ||
      !adminEmail.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/register-institute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institute_name: instituteName.trim(),
          city: city.trim(),
          state: state.trim(),
          admin_name: adminName.trim(),
          admin_email: adminEmail.trim(),
          password: password,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Registration failed')

      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4 py-8">
      <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl shadow p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">EduPulse</h1>
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm mt-1">Register your coaching institute</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-green-800 text-sm">
                Registration successful! Check your email to confirm your account, then login.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="institute-name" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Institute name
              </label>
              <input
                id="institute-name"
                type="text"
                required
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                placeholder="ABC Coaching Centre"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                  placeholder="Hyderabad"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                  placeholder="Telangana"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Admin name
              </label>
              <input
                id="admin-name"
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Admin email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
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
              {loading ? 'Registering…' : 'Register'}
            </button>

            <p className="text-center text-sm text-gray-500 dark:text-[#A8A8A8]">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
