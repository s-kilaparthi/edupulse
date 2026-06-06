import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

const INSTITUTE_ID = '8535a900-49f5-405a-9d25-05c20dcba910'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function AnnouncementsSection({ announcements, navigate }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Recent Announcements</h2>
        <button
          type="button"
          onClick={() => navigate('/announcements')}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          View all
        </button>
      </div>
      {announcements.length === 0 && (
        <p className="text-sm text-gray-400">No announcements yet.</p>
      )}
      {announcements.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => navigate('/announcements')}
          className="w-full text-left"
        >
          <div
            className={`rounded-xl border p-4 mb-3 shadow-sm ${
              a.is_pinned ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {a.is_pinned && <span className="text-xs text-yellow-600">📌</span>}
              <p className="font-medium text-gray-900 text-sm">{a.title}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {a.subjects?.name ?? 'Institute-wide'} · {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { session } = useOutletContext()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState('student')
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState({})
  const [recentAnnouncements, setRecentAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return

    async function loadDashboard() {
      setLoading(true)

      const { data: userData } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', session.user.id)
        .single()

      const role = userData?.role ?? 'student'
      const name = userData?.name ?? ''
      setUserRole(role)
      setUserName(name)

      const { data: announcementData } = await supabase
        .from('announcements')
        .select('id, title, body, is_pinned, created_at, subjects(name)')
        .eq('institute_id', INSTITUTE_ID)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)

      if (announcementData) setRecentAnnouncements(announcementData)

      if (role === 'student') {
        const { data: scoreRows } = await supabase
          .from('topic_scores')
          .select('exam_id, subject_id, score, total, exams(name, exam_date)')
          .eq('student_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        let lastExamName = '—'
        let lastExamScore = 0
        let lastExamTotal = 0
        let lastExamPct = 0

        if (scoreRows?.length) {
          const latestExamId = scoreRows[0].exam_id
          const examRows = scoreRows.filter((r) => r.exam_id === latestExamId)
          lastExamName = examRows[0]?.exams?.name ?? '—'
          lastExamScore = examRows.reduce((sum, r) => sum + r.score, 0)
          lastExamTotal = examRows.reduce((sum, r) => sum + r.total, 0)
          lastExamPct = lastExamTotal > 0
            ? Math.round((lastExamScore / lastExamTotal) * 100)
            : 0
        }

        const { data: subjectRows } = await supabase
          .from('topic_scores')
          .select('subject_id')
          .eq('student_id', session.user.id)

        const subjectsEnrolled = new Set(
          (subjectRows ?? []).map((r) => r.subject_id).filter(Boolean)
        ).size

        setStats({ lastExamName, lastExamScore, lastExamTotal, lastExamPct, subjectsEnrolled })
      } else if (role === 'teacher') {
        const { count: studentCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student')

        const { count: examCount } = await supabase
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', session.user.id)

        const { data: teacherExams } = await supabase
          .from('exams')
          .select('id')
          .eq('created_by', session.user.id)

        let lastScanDate = null
        let lastScanExamName = '—'

        if (teacherExams?.length) {
          const examIds = teacherExams.map((e) => e.id)
          const { data: lastScan } = await supabase
            .from('omr_results')
            .select('created_at, exams(name)')
            .in('exam_id', examIds)
            .order('created_at', { ascending: false })
            .limit(1)

          if (lastScan?.length) {
            lastScanDate = lastScan[0].created_at
            lastScanExamName = lastScan[0].exams?.name ?? '—'
          }
        }

        setStats({
          totalStudents: studentCount ?? 0,
          examsCreated: examCount ?? 0,
          lastScanDate,
          lastScanExamName,
        })
      }

      setLoading(false)
    }

    loadDashboard()
  }, [session])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {userRole === 'student' && (
        <>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">EduPulse</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Welcome back, {userName}!</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              label="Last Exam Score"
              value={`${stats.lastExamScore ?? 0} / ${stats.lastExamTotal ?? 0} (${stats.lastExamPct ?? 0}%)`}
              sub={stats.lastExamName}
            />
            <StatCard
              label="Subjects Enrolled"
              value={stats.subjectsEnrolled ?? 0}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/results')}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              View My Performance
            </button>
          </div>
        </>
      )}

      {userRole === 'teacher' && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Welcome, {userName}!</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Students" value={stats.totalStudents ?? 0} />
            <StatCard label="Exams Created" value={stats.examsCreated ?? 0} />
            <StatCard
              label="Last Scan Date"
              value={stats.lastScanDate
                ? new Date(stats.lastScanDate).toLocaleDateString()
                : '—'}
              sub={stats.lastScanExamName}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/scan')}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Start Scanning
            </button>
            <button
              type="button"
              onClick={() => navigate('/results', { state: { tab: 'heatmap' } })}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              View Class Heatmap
            </button>
          </div>
        </>
      )}

      {userRole === 'admin' && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Welcome, Admin!</h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Admin Dashboard
          </button>
        </>
      )}

      <AnnouncementsSection announcements={recentAnnouncements} navigate={navigate} />
    </div>
  )
}
