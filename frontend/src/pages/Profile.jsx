import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Profile() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingPassword, setEditingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [attendanceSummary, setAttendanceSummary] = useState([])
  const [recentExams, setRecentExams] = useState([])

  useEffect(() => {
    if (!session?.user?.id) return

    supabase
      .from('users')
      .select('id, name, email, roll_number, role, institute_id, class_id, classes(name), institutes(name, city)')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setUserRole(data.role)

          if (data.role === 'student') {
            supabase
              .from('attendance')
              .select('status, subject_id, subjects(name)')
              .eq('student_id', session.user.id)
              .then(({ data: attendanceData }) => {
                const subjectMap = {}
                for (const row of attendanceData ?? []) {
                  const sname = row.subjects?.name ?? 'Unknown'
                  if (!subjectMap[sname]) subjectMap[sname] = { present: 0, total: 0 }
                  subjectMap[sname].total += 1
                  if (row.status === 'present' || row.status === 'late') {
                    subjectMap[sname].present += 1
                  }
                }
                const summary = Object.entries(subjectMap).map(([name, { present, total }]) => ({
                  name,
                  present,
                  total,
                  pct: total > 0 ? Math.round((present / total) * 100) : 0,
                }))
                setAttendanceSummary(summary)
              })

            supabase
              .from('topic_scores')
              .select('exam_id, score, total, exams(name, exam_date)')
              .eq('student_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(20)
              .then(({ data: scoreData }) => {
                const examMap = {}
                for (const row of scoreData ?? []) {
                  const eid = row.exam_id
                  if (!examMap[eid]) {
                    examMap[eid] = {
                      name: row.exams?.name,
                      date: row.exams?.exam_date,
                      score: 0,
                      total: 0,
                    }
                  }
                  examMap[eid].score += row.score
                  examMap[eid].total += row.total
                }
                const exams = Object.values(examMap).map((e) => ({
                  ...e,
                  pct: e.total > 0 ? Math.round((e.score / e.total) * 100) : 0,
                }))
                setRecentExams(exams.slice(0, 5))
              })
          }
        }
        setLoading(false)
      })
  }, [session])

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess('Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setEditingPassword(false)
    }
    setSavingPassword(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xl font-bold">
              {profile?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile?.name}</h1>
            <p className="text-sm text-gray-500">{profile?.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Roll Number</p>
            <p className="font-semibold text-gray-900">{profile?.roll_number ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Class</p>
            <p className="font-semibold text-gray-900">{profile?.classes?.name ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Institute</p>
            <p className="font-semibold text-gray-900">{profile?.institutes?.name ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">City</p>
            <p className="font-semibold text-gray-900">{profile?.institutes?.city ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
          <button
            type="button"
            onClick={() => setEditingPassword(!editingPassword)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {editingPassword ? 'Cancel' : 'Change'}
          </button>
        </div>

        {editingPassword && (
          <div className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-green-600">{passwordSuccess}</p>}
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {savingPassword ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        )}
      </div>

      {userRole === 'student' && attendanceSummary.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">My Attendance</h2>
          <div className="space-y-3">
            {attendanceSummary.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400">
                    {s.present}/{s.total} classes
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    s.pct >= 75 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {s.pct}% {s.pct < 75 && '⚠️'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {userRole === 'student' && recentExams.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Exams</h2>
          <div className="space-y-2">
            {recentExams.map((exam, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{exam.name}</p>
                  <p className="text-xs text-gray-400">{exam.date}</p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    exam.pct >= 75
                      ? 'text-green-600'
                      : exam.pct >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {exam.score}/{exam.total} ({exam.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
