import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function formatTime12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function StatCard({ label, value, sub, onClick, hint }) {
  const className = `rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
    onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''
  }`

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-500">{label}</p>
        {hint && <span className="text-xs text-blue-600 font-medium shrink-0">{hint}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left w-full`}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
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
            className={`rounded-xl border p-4 mb-3 shadow-sm overflow-hidden ${
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
  const [instituteId, setInstituteId] = useState(null)
  const [userLoaded, setUserLoaded] = useState(false)
  const [stats, setStats] = useState({})
  const [studentInfo, setStudentInfo] = useState({})
  const [adminStats, setAdminStats] = useState({
    students: 0,
    teachers: 0,
    exams: 0,
    avg: 0,
  })
  const [recentAnnouncements, setRecentAnnouncements] = useState([])
  const [todaySchedule, setTodaySchedule] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role, name, institute_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role)
          setUserName(data.name)
          setInstituteId(data.institute_id)
        }
        setUserLoaded(true)
      })
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || !userLoaded) return

    async function loadDashboard() {
      setLoading(true)

      const { data: announcementData } = await supabase.rpc('get_my_announcements')
      setRecentAnnouncements((announcementData ?? []).slice(0, 3))

      if (userRole === 'student') {
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

        const { data: userData } = await supabase
          .from('users')
          .select('class_id, roll_number, classes(name)')
          .eq('id', session.user.id)
          .single()

        const studentClassId = userData?.class_id
        const studentRollNo = userData?.roll_number
        const studentClassName = userData?.classes?.name

        setStudentInfo({
          classId: studentClassId,
          rollNo: studentRollNo,
          className: studentClassName,
        })

        if (studentClassId) {
          const dayName = DAYS[new Date().getDay()]
          const { data: slots } = await supabase
            .from('schedule_slots')
            .select('period_number, start_time, subjects(name), users(name)')
            .eq('class_id', studentClassId)
            .eq('day_of_week', dayName)
            .order('period_number')
            .limit(8)

          setTodaySchedule(slots ?? [])
        } else {
          setTodaySchedule([])
        }

        setStats({
          lastExamName,
          lastExamScore,
          lastExamTotal,
          lastExamPct,
        })
      } else if (userRole === 'teacher') {
        const { data: teacherClassesData } = await supabase
          .from('class_teachers')
          .select('class_id, classes(id, name)')
          .eq('teacher_id', session.user.id)

        const classIds = [...new Set(teacherClassesData?.map((tc) => tc.class_id) ?? [])]

        let studentCount = 0
        if (classIds.length > 0) {
          const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('role', 'student')
            .in('class_id', classIds)
          studentCount = count ?? 0
        }

        const { count: examCount } = await supabase
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', session.user.id)

        setStats({
          myClasses: classIds.length,
          myStudents: studentCount,
          examsCreated: examCount ?? 0,
        })
      } else if (userRole === 'admin' && instituteId) {
        const [studentsRes, teachersRes, scoresRes] = await Promise.all([
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student')
            .eq('institute_id', instituteId),
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'teacher')
            .eq('institute_id', instituteId),
          supabase.from('topic_scores').select('percentage'),
        ])

        const { data: classData } = await supabase
          .from('classes')
          .select('id')
          .eq('institute_id', instituteId)

        const classIds = classData?.map((c) => c.id) ?? []

        let examCount = 0
        if (classIds.length > 0) {
          const { count } = await supabase
            .from('exam_classes')
            .select('exam_id', { count: 'exact', head: true })
            .in('class_id', classIds)
          examCount = count ?? 0
        }

        const pcts = (scoresRes.data ?? [])
          .map((r) => r.percentage)
          .filter((p) => p != null)
        const avg =
          pcts.length > 0
            ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
            : 0

        setAdminStats({
          students: studentsRes.count ?? 0,
          teachers: teachersRes.count ?? 0,
          exams: examCount,
          avg,
        })
      }

      setLoading(false)
    }

    loadDashboard()
  }, [session, userLoaded, instituteId, userRole])

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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">Welcome back, {userName}!</h1>
            <div className="flex flex-wrap gap-3 mt-2">
              {studentInfo.className && (
                <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full font-medium">
                  📚 {studentInfo.className}
                </span>
              )}
              {studentInfo.rollNo && (
                <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full font-medium">
                  🎓 Roll #{studentInfo.rollNo}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s Schedule</h2>
            {todaySchedule.length === 0 ? (
              <p className="text-sm text-gray-500">No classes scheduled today</p>
            ) : (
              <ul className="space-y-2">
                {todaySchedule.map((slot) => (
                  <li key={slot.period_number} className="text-sm text-gray-700">
                    Period {slot.period_number} · {formatTime12(slot.start_time)} ·{' '}
                    {slot.subjects?.name ?? 'Subject'} · {slot.users?.name ?? 'Teacher'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <StatCard
            label="Last Exam Score"
            value={`${stats.lastExamScore ?? 0} / ${stats.lastExamTotal ?? 0} (${stats.lastExamPct ?? 0}%)`}
            sub={stats.lastExamName}
            onClick={() => navigate('/results')}
            hint="View Results →"
          />
        </>
      )}

      {userRole === 'teacher' && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">Welcome, {userName}!</h1>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate('/subjects')}
              className="text-left w-full"
            >
              <StatCard label="My Classes" value={stats.myClasses ?? 0} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/students')}
              className="text-left w-full"
            >
              <StatCard label="My Students" value={stats.myStudents ?? 0} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/exams')}
              className="text-left w-full"
            >
              <StatCard label="Exams Created" value={stats.examsCreated ?? 0} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate('/attendance')}
              className="w-full bg-green-600 text-white font-medium px-4 py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              ✅ Mark Attendance
            </button>
            <button
              type="button"
              onClick={() => navigate('/scan')}
              className="w-full bg-blue-600 text-white font-medium px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              📷 Start Scanning
            </button>
            <button
              type="button"
              onClick={() => navigate('/results', { state: { tab: 'heatmap' } })}
              className="w-full bg-purple-600 text-white font-medium px-4 py-3 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              📊 View Heatmap
            </button>
          </div>
        </>
      )}

      {userRole === 'admin' && (
        <>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse Admin</p>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Welcome, {userName}!</h1>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Students" value={adminStats.students} />
            <StatCard label="Total Teachers" value={adminStats.teachers} />
            <StatCard label="Total Exams" value={adminStats.exams} />
            <StatCard label="Institute Avg" value={`${adminStats.avg}%`} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/classes')}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Manage Classes
            </button>
            <button
              type="button"
              onClick={() => navigate('/students')}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Manage Students
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Full Admin Panel
            </button>
          </div>

          <AnnouncementsSection announcements={recentAnnouncements} navigate={navigate} />
        </>
      )}

      {(userRole === 'student' || userRole === 'teacher') && (
        <AnnouncementsSection announcements={recentAnnouncements} navigate={navigate} />
      )}
    </div>
  )
}
