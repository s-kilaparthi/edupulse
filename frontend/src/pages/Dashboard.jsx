import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const BAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']

const CLASS_CARD_TOP_BORDERS = [
  'border-t-blue-500',
  'border-t-green-500',
  'border-t-orange-500',
  'border-t-purple-500',
]

const PERIOD_END_TIMES = {
  1: '10:00',
  2: '11:00',
  3: '12:00',
  4: '13:00',
  5: '14:00',
  6: '15:00',
  7: '16:00',
  8: '17:00',
}

function formatTime12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatTodayDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function todayDateStr() {
  return new Date().toISOString().split('T')[0]
}

function getTimeGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good Morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good Afternoon', emoji: '🌤️' }
  return { text: 'Good Evening', emoji: '🌙' }
}

function getRoleTimeGreeting(name) {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return `Good Morning, ${name}! ☀️`
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}! 🌤️`
  if (hour >= 17 && hour < 21) return `Good Evening, ${name}! 🌙`
  return `Good Night, ${name}! 🌙`
}

function AdminStatCard({ icon, label, value, borderColor, onClick }) {
  const className = `rounded-xl shadow-sm bg-white p-4 border-t-4 ${borderColor} ${
    onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 transition-all text-left w-full' : ''
  }`

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl">{icon}</span>
        {onClick && <span className="text-xs text-blue-600 font-medium shrink-0">→</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function AdminSectionTitle({ title, barColor = 'bg-blue-500' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-1 h-5 ${barColor} rounded-full`} />
      <h2 className="font-bold text-gray-800 text-base">{title}</h2>
    </div>
  )
}

function AdminZoneHeader({ label, barColor = 'bg-blue-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-6 ${barColor} rounded-full`} />
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</h2>
    </div>
  )
}

function formatExamClassLabel(exam) {
  if (exam.scope === 'institute') return 'Whole Institute'
  const names = (exam.exam_classes ?? [])
    .map((ec) => ec.classes?.name)
    .filter(Boolean)
  return names.length > 0 ? names.join(', ') : '—'
}

function formatExamDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString()
}

function isInstituteExam(exam, classIdSet) {
  if (exam.scope === 'institute') return true
  return (exam.exam_classes ?? []).some((ec) => classIdSet.has(ec.class_id))
}

function getPeriodEndTime(periodNumber, startTime) {
  return PERIOD_END_TIMES[periodNumber] ?? startTime?.slice(0, 5) ?? ''
}

function studentCanSeeAnnouncement(announcement, studentClassId, studentId) {
  const { target_type, target_ids } = announcement
  const ids = target_ids ?? []
  if (target_type === 'everyone' || target_type === 'all_students') return true
  if (target_type === 'class_students' && studentClassId) {
    return ids.includes(studentClassId)
  }
  if (target_type === 'specific_student') {
    return ids.includes(studentId)
  }
  if (!target_type) return true
  return false
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

function daysUntilDeadline(deadlineStr, todayStr) {
  const today = new Date(todayStr + 'T00:00:00')
  const deadline = new Date(deadlineStr + 'T00:00:00')
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24))
}

function sortTasks(tasks) {
  const today = todayDateStr()

  const group = (task) => {
    if (task.is_completed) return 5
    if (!task.deadline) return 4
    if (task.deadline < today) return 0
    if (task.deadline === today) return 1
    return 2
  }

  return [...tasks].sort((a, b) => {
    const ga = group(a)
    const gb = group(b)
    if (ga !== gb) return ga - gb
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline.localeCompare(b.deadline)
  })
}

function getTaskPriorityDot(deadline, isCompleted) {
  if (isCompleted || !deadline) return '⚪'
  const today = todayDateStr()
  if (deadline < today || deadline === today) return '🔴'
  const days = daysUntilDeadline(deadline, today)
  if (days <= 3) return '🟡'
  return '🟢'
}

function formatTaskDeadline(deadline, isCompleted) {
  if (!deadline) return null
  const today = todayDateStr()
  if (!isCompleted && deadline < today) return { text: 'Overdue', overdue: true }
  return {
    text: new Date(deadline + 'T00:00:00').toLocaleDateString(),
    overdue: false,
  }
}

function TodoListSection({ userId }) {
  const [tasks, setTasks] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('tasks')
      .select('id, title, deadline, is_completed')
      .eq('user_id', userId)
    setTasks(data ?? [])
  }, [userId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const pendingCount = tasks.filter((t) => !t.is_completed).length
  const sortedTasks = sortTasks(tasks)

  async function handleAddTask() {
    const title = taskTitle.trim()
    if (!title || !userId) return

    setSaving(true)
    await supabase.from('tasks').insert({
      title,
      deadline: taskDeadline || null,
      user_id: userId,
      is_completed: false,
    })
    setTaskTitle('')
    setTaskDeadline('')
    await fetchTasks()
    setSaving(false)
  }

  async function handleToggleComplete(task) {
    await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id)
    await fetchTasks()
  }

  async function handleDeleteTask(taskId) {
    if (!window.confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    await fetchTasks()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">
          📋 My Tasks ({pendingCount} pending)
        </span>
        <span className="text-xs text-gray-400 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row gap-2 mt-3 mb-4">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTask()
                }
              }}
              placeholder="Enter task..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <div className="flex flex-col shrink-0">
              <label className="text-xs text-gray-500 mb-1">Deadline</label>
              <input
                type="date"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTask}
              disabled={saving || !taskTitle.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tasks yet. Add one above! ✨</p>
          ) : (
            <ul className="space-y-2">
              {sortedTasks.map((task) => {
                const deadlineInfo = formatTaskDeadline(task.deadline, task.is_completed)
                return (
                  <li
                    key={task.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border border-gray-100 ${
                      task.is_completed ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="text-sm shrink-0" aria-hidden="true">
                      {getTaskPriorityDot(task.deadline, task.is_completed)}
                    </span>
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => handleToggleComplete(task)}
                      className="rounded border-gray-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm text-gray-900 ${
                          task.is_completed ? 'line-through text-gray-500' : ''
                        }`}
                      >
                        {task.title}
                      </p>
                      {deadlineInfo && (
                        <p
                          className={`text-xs mt-0.5 ${
                            deadlineInfo.overdue ? 'text-red-600 font-medium' : 'text-gray-500'
                          }`}
                        >
                          {deadlineInfo.text}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-gray-400 hover:text-red-600 text-sm shrink-0 p-1"
                      aria-label="Delete task"
                    >
                      🗑️
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
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
  const [parentName, setParentName] = useState('')
  const [instituteName, setInstituteName] = useState('')
  const [adminStats, setAdminStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    avg: 0,
    attendanceMarked: 0,
    attendanceTotal: 0,
  })
  const [adminAttendanceClasses, setAdminAttendanceClasses] = useState([])
  const [adminTodayExams, setAdminTodayExams] = useState([])
  const [adminPendingGrading, setAdminPendingGrading] = useState([])
  const [adminWeekActivity, setAdminWeekActivity] = useState({
    announcementCount: 0,
    lastAnnouncementTitle: null,
    gradedExamsCount: 0,
  })
  const [adminBestClass, setAdminBestClass] = useState(null)
  const [adminWorstClass, setAdminWorstClass] = useState(null)
  const [recentAnnouncements, setRecentAnnouncements] = useState([])
  const [todaySchedule, setTodaySchedule] = useState([])
  const [teacherClassCards, setTeacherClassCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role, name, institute_id, institutes(name)')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role)
          setUserName(data.name)
          setInstituteId(data.institute_id)
          if (data.institutes?.name) setInstituteName(data.institutes.name)
        }
        setUserLoaded(true)
      })
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || !userLoaded) return

    async function loadDashboard() {
      setLoading(true)

      const { data: announcementData } = await supabase.rpc('get_my_announcements')

      if (userRole === 'student' || userRole === 'parent') {
        let studentId = session.user.id
        let studentClassId = null
        let studentRollNo = null
        let studentClassName = null
        let studentDisplayName = userName

        if (userRole === 'parent') {
          const { data: parentData } = await supabase
            .from('users')
            .select('name, parent_name, roll_number, institute_id')
            .eq('id', session.user.id)
            .single()

          setParentName(parentData?.parent_name || parentData?.name || '')

          const linkedStudent = await fetchLinkedStudent(parentData)
          if (!linkedStudent) {
            setStats({})
            setStudentInfo({})
            setTodaySchedule([])
            setLoading(false)
            return
          }

          studentId = linkedStudent.id
          studentClassId = linkedStudent.class_id
          studentRollNo = linkedStudent.roll_number
          studentClassName = linkedStudent.classes?.name
          studentDisplayName = linkedStudent.name
        } else {
          const { data: userData } = await supabase
            .from('users')
            .select('class_id, roll_number, classes(name)')
            .eq('id', session.user.id)
            .single()

          studentClassId = userData?.class_id
          studentRollNo = userData?.roll_number
          studentClassName = userData?.classes?.name
        }

        const { data: scoreRows } = await supabase
          .from('topic_scores')
          .select('exam_id, subject_id, score, total, exams(name, exam_date)')
          .eq('student_id', studentId)
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

          const { data: examMeta } = await supabase
            .from('exams')
            .select('exam_type')
            .eq('id', latestExamId)
            .single()

          if (examMeta?.exam_type === 'written') {
            const { data: summary } = await supabase
              .from('omr_results')
              .select('marks_obtained, total_marks')
              .eq('exam_id', latestExamId)
              .eq('student_id', studentId)
              .is('question_id', null)
              .maybeSingle()

            if (summary) {
              lastExamScore = summary.marks_obtained ?? 0
              lastExamTotal = summary.total_marks ?? 0
              lastExamPct = lastExamTotal > 0
                ? Math.round((lastExamScore / lastExamTotal) * 100)
                : 0
            }
          } else {
            lastExamScore = examRows.reduce((sum, r) => sum + r.score, 0)
            lastExamTotal = examRows.reduce((sum, r) => sum + r.total, 0)
            lastExamPct = lastExamTotal > 0
              ? Math.round((lastExamScore / lastExamTotal) * 100)
              : 0
          }
        }

        setStudentInfo({
          classId: studentClassId,
          rollNo: studentRollNo,
          className: studentClassName,
          studentName: studentDisplayName,
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

        let announcements = announcementData ?? []
        if (userRole === 'parent') {
          announcements = announcements.filter((a) =>
            studentCanSeeAnnouncement(a, studentClassId, studentId)
          )
        }
        setRecentAnnouncements(announcements.slice(0, 3))
      } else if (userRole === 'teacher') {
        setRecentAnnouncements((announcementData ?? []).slice(0, 3))

        const dayName = DAYS[new Date().getDay()]
        const today = todayDateStr()

        let slotsQuery = supabase
          .from('schedule_slots')
          .select('period_number, start_time, end_time, subjects(name), classes(name)')
          .eq('teacher_id', session.user.id)
          .eq('day_of_week', dayName)
          .order('period_number')

        if (instituteId) {
          slotsQuery = slotsQuery.eq('institute_id', instituteId)
        }

        const { data: slots } = await slotsQuery

        setTodaySchedule(slots ?? [])

        const { data: teacherAssignments } = await supabase
          .from('class_teachers')
          .select('class_id, subject_id, classes(id, name), subjects(name)')
          .eq('teacher_id', session.user.id)

        const classMap = {}
        for (const row of teacherAssignments ?? []) {
          const classId = row.class_id
          if (!classMap[classId]) {
            classMap[classId] = {
              classId,
              className: row.classes?.name ?? 'Class',
              subjects: [],
            }
          }
          const subjectName = row.subjects?.name
          if (subjectName && !classMap[classId].subjects.includes(subjectName)) {
            classMap[classId].subjects.push(subjectName)
          }
        }

        const classCards = await Promise.all(
          Object.values(classMap).map(async (cls) => {
            const [{ count: studentCount }, { data: attendanceToday }] = await Promise.all([
              supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'student')
                .eq('class_id', cls.classId),
              supabase
                .from('attendance')
                .select('id')
                .eq('class_id', cls.classId)
                .eq('date', today)
                .eq('marked_by', session.user.id)
                .limit(1),
            ])

            return {
              ...cls,
              studentCount: studentCount ?? 0,
              attendanceMarked: (attendanceToday?.length ?? 0) > 0,
            }
          })
        )

        classCards.sort((a, b) => a.className.localeCompare(b.className))
        setTeacherClassCards(classCards)
      } else if (userRole === 'admin' && instituteId) {
        const today = todayDateStr()
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekAgoIso = weekAgo.toISOString()

        const [studentsRes, teachersRes, instituteRes, classRes, studentsForScores] =
          await Promise.all([
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
            supabase
              .from('institutes')
              .select('name')
              .eq('id', instituteId)
              .single(),
            supabase
              .from('classes')
              .select('id, name')
              .eq('institute_id', instituteId)
              .order('name'),
            supabase
              .from('users')
              .select('id, class_id')
              .eq('role', 'student')
              .eq('institute_id', instituteId),
          ])

        const classes = classRes.data ?? []
        const classIds = classes.map((c) => c.id)
        const classIdSet = new Set(classIds)
        const classNameMap = Object.fromEntries(classes.map((c) => [c.id, c.name]))
        const studentRows = studentsForScores.data ?? []
        const studentIds = studentRows.map((s) => s.id)
        const studentClassMap = Object.fromEntries(
          studentRows.filter((s) => s.class_id).map((s) => [s.id, s.class_id])
        )

        let markedClassIds = new Set()
        if (classIds.length > 0) {
          const { data: attendanceToday } = await supabase
            .from('attendance')
            .select('class_id')
            .eq('date', today)
            .eq('institute_id', instituteId)
            .in('class_id', classIds)

          markedClassIds = new Set((attendanceToday ?? []).map((a) => a.class_id))
        }

        const attendanceClasses = classes.map((c) => ({
          id: c.id,
          name: c.name,
          marked: markedClassIds.has(c.id),
        }))

        let scoresData = []
        if (studentIds.length > 0) {
          const { data: scores } = await supabase
            .from('topic_scores')
            .select('percentage, student_id, exam_id, created_at')
            .in('student_id', studentIds)
          scoresData = scores ?? []
        }

        const pcts = scoresData.map((r) => r.percentage).filter((p) => p != null)
        const avg =
          pcts.length > 0
            ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
            : 0

        const classTotals = {}
        const classCounts = {}
        for (const row of scoresData) {
          if (row.percentage == null) continue
          const classId = studentClassMap[row.student_id]
          if (!classId) continue
          classTotals[classId] = (classTotals[classId] ?? 0) + row.percentage
          classCounts[classId] = (classCounts[classId] ?? 0) + 1
        }

        const classAvgs = Object.keys(classTotals)
          .map((classId) => ({
            classId,
            name: classNameMap[classId] ?? 'Class',
            avg: Math.round(classTotals[classId] / classCounts[classId]),
          }))
          .sort((a, b) => b.avg - a.avg)

        const { data: allExamsRaw } = await supabase
          .from('exams')
          .select(
            'id, name, exam_date, exam_type, scope, exam_types(name), exam_classes(class_id, classes(name))'
          )
          .order('exam_date', { ascending: false })

        const instituteExams = (allExamsRaw ?? []).filter((e) =>
          isInstituteExam(e, classIdSet)
        )

        const todayExams = instituteExams.filter((e) => e.exam_date === today)
        const pastExams = instituteExams.filter((e) => e.exam_date < today)
        const pastExamIds = pastExams.map((e) => e.id)
        const instituteExamIds = instituteExams.map((e) => e.id)

        const examsWithResults = new Set()
        if (pastExamIds.length > 0) {
          const [omrRes, tsRes] = await Promise.all([
            supabase.from('omr_results').select('exam_id').in('exam_id', pastExamIds),
            supabase.from('topic_scores').select('exam_id').in('exam_id', pastExamIds),
          ])
          for (const row of omrRes.data ?? []) examsWithResults.add(row.exam_id)
          for (const row of tsRes.data ?? []) examsWithResults.add(row.exam_id)
        }

        const pendingGrading = pastExams.filter((e) => !examsWithResults.has(e.id))

        const weekAnnouncements = (announcementData ?? []).filter(
          (a) => new Date(a.created_at) >= weekAgo
        )
        const sortedWeekAnnouncements = [...weekAnnouncements].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )

        const gradedExamsThisWeek = new Set()
        if (instituteExamIds.length > 0) {
          const [omrWeekRes, tsWeekRes] = await Promise.all([
            supabase
              .from('omr_results')
              .select('exam_id, created_at')
              .in('exam_id', instituteExamIds)
              .gte('created_at', weekAgoIso),
            supabase
              .from('topic_scores')
              .select('exam_id, created_at')
              .in('exam_id', instituteExamIds)
              .gte('created_at', weekAgoIso),
          ])
          for (const row of omrWeekRes.data ?? []) {
            if (row.exam_id) gradedExamsThisWeek.add(row.exam_id)
          }
          for (const row of tsWeekRes.data ?? []) {
            if (row.exam_id) gradedExamsThisWeek.add(row.exam_id)
          }
        }

        setInstituteName(instituteRes.data?.name ?? '')
        setAdminStats({
          students: studentsRes.count ?? 0,
          teachers: teachersRes.count ?? 0,
          classes: classIds.length,
          avg,
          attendanceMarked: markedClassIds.size,
          attendanceTotal: classIds.length,
        })
        setAdminAttendanceClasses(attendanceClasses)
        setAdminTodayExams(todayExams)
        setAdminPendingGrading(pendingGrading)
        setAdminWeekActivity({
          announcementCount: weekAnnouncements.length,
          lastAnnouncementTitle: sortedWeekAnnouncements[0]?.title ?? null,
          gradedExamsCount: gradedExamsThisWeek.size,
        })
        setAdminBestClass(classAvgs[0] ?? null)
        setAdminWorstClass(classAvgs.length > 1 ? classAvgs[classAvgs.length - 1] : null)
        setRecentAnnouncements((announcementData ?? []).slice(0, 3))
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

  const timeGreeting = getTimeGreeting()

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {(userRole === 'student' || userRole === 'parent') && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-100 p-5 shadow-sm">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              {getRoleTimeGreeting(userRole === 'parent' ? parentName : userName)}
            </h1>
            {instituteName && (
              <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
            )}
            {userRole === 'parent' ? (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                👨‍👩‍👧 Parent · Viewing: {studentInfo.studentName ?? 'Student'}
              </span>
            ) : (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                🎓 Student
              </span>
            )}
            {userRole === 'student' && (
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
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Schedule</h2>
              <span className="text-xs text-gray-500">{formatTodayDate()}</span>
            </div>
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm text-gray-500">No classes scheduled today</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0">
                {todaySchedule.map((slot, index) => (
                  <div
                    key={slot.period_number}
                    className="flex rounded-xl shadow-sm bg-white p-4 min-w-[160px] shrink-0 border border-gray-100 overflow-hidden"
                  >
                    <div
                      className={`w-1 shrink-0 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                    />
                    <div className="pl-3 flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs text-gray-500">Period {slot.period_number}</p>
                      <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                        {formatTime12(slot.start_time)} –{' '}
                        {formatTime12(getPeriodEndTime(slot.period_number, slot.start_time))}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 truncate">
                        {slot.subjects?.name ?? 'Subject'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        👤 {slot.users?.name ?? 'Teacher'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-100 p-5 shadow-sm">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              {getRoleTimeGreeting(userName)}
            </h1>
            {instituteName && (
              <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
            )}
            <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              👨‍🏫 Teacher
            </span>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-blue-500 rounded-full" />
                <h2 className="font-bold text-gray-800 text-base">Today&apos;s Schedule</h2>
              </div>
              <span className="text-xs text-gray-500">{formatTodayDate()}</span>
            </div>
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm text-gray-500">No classes scheduled today</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0">
                {todaySchedule.map((slot, index) => (
                  <div
                    key={`${slot.period_number}-${index}`}
                    className="flex rounded-xl shadow-sm bg-white p-4 min-w-[160px] shrink-0 border border-gray-100 overflow-hidden"
                  >
                    <div
                      className={`w-1 shrink-0 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                    />
                    <div className="pl-3 flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs text-gray-500">Period {slot.period_number}</p>
                      <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                        {formatTime12(slot.start_time)} –{' '}
                        {formatTime12(
                          slot.end_time?.slice(0, 5) ??
                            getPeriodEndTime(slot.period_number, slot.start_time)
                        )}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 truncate">
                        {slot.subjects?.name ?? 'Subject'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        🏫 {slot.classes?.name ?? 'Class'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <TodoListSection userId={session?.user?.id} />

          {teacherClassCards.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-purple-500 rounded-full" />
                <h2 className="font-bold text-gray-800 text-base">My Classes</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
              {teacherClassCards.map((cls, index) => (
                <div
                  key={cls.classId}
                  className={`rounded-xl shadow-sm bg-white p-3 border border-gray-100 border-t-4 ${CLASS_CARD_TOP_BORDERS[index % CLASS_CARD_TOP_BORDERS.length]} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">{cls.className}</p>
                    {cls.attendanceMarked ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                        ✅ Marked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/attendance')}
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0 hover:bg-orange-200 transition-colors"
                      >
                        ⚠️ Pending
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {cls.subjects.length > 0 ? cls.subjects.join(', ') : 'No subjects assigned'}
                  </p>
                  <p className="text-xs text-gray-600">👥 {cls.studentCount} Students</p>
                </div>
              ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate('/subjects')}
              className="bg-indigo-500 text-white font-semibold p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 hover:bg-indigo-600 transition-colors"
            >
              <span className="text-xl">📚</span>
              <span className="text-sm">View Subjects</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/students')}
              className="bg-emerald-500 text-white font-semibold p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 hover:bg-emerald-600 transition-colors"
            >
              <span className="text-xl">👥</span>
              <span className="text-sm">View Students</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/exams')}
              className="bg-orange-500 text-white font-semibold p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 hover:bg-orange-600 transition-colors"
            >
              <span className="text-xl">📝</span>
              <span className="text-sm">View Exams</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl">📝</span>
            Start Grading
          </button>
        </>
      )}

      {userRole === 'admin' && (
        <>
          {/* ZONE 1 — Today */}
          <div className="flex flex-col gap-5">
            <AdminZoneHeader label="Today" barColor="bg-blue-500" />

            <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-100 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    {timeGreeting.text}, Admin! {timeGreeting.emoji}
                  </h1>
                  {instituteName && (
                    <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">
                    {adminStats.students} Students · {adminStats.teachers} Teachers · {adminStats.classes} Classes
                  </p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium shrink-0">
                  Admin
                </span>
              </div>
            </div>

            <AdminSectionTitle title="Today's Attendance" barColor="bg-green-500" />
            {adminAttendanceClasses.length === 0 ? (
              <p className="text-sm text-gray-400">No classes in this institute yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {adminAttendanceClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-xl shadow-sm bg-white p-3 border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">{cls.name}</p>
                      {cls.marked ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                          ✅ Marked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/attendance')}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0 hover:bg-orange-200 transition-colors"
                        >
                          ⚠️ Pending
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <TodoListSection userId={session?.user?.id} />

            <AdminSectionTitle title="Today's Exams" barColor="bg-orange-500" />
            {adminTodayExams.length === 0 ? (
              <p className="text-sm text-gray-400">No exams scheduled today</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {adminTodayExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="rounded-xl shadow-sm bg-white p-3 border border-gray-100"
                  >
                    <p className="font-semibold text-gray-900 text-sm">{exam.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatExamClassLabel(exam)}</p>
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                      {exam.exam_types?.name ?? (exam.exam_type === 'written' ? 'Written' : 'MCQ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/results')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium self-start"
            >
              View Results →
            </button>
          </div>

          {/* ZONE 2 — This Week */}
          <div className="flex flex-col gap-5">
            <AdminZoneHeader label="This Week" barColor="bg-purple-500" />

            <AdminSectionTitle title="Pending Grading" barColor="bg-orange-500" />
            {adminPendingGrading.length === 0 ? (
              <p className="text-sm text-green-600 font-medium">All exams graded ✅</p>
            ) : (
              <div className="space-y-2">
                {adminPendingGrading.map((exam) => (
                  <div
                    key={exam.id}
                    className="rounded-xl shadow-sm bg-white p-3 border border-orange-100 border-l-4 border-l-orange-400"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{exam.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {formatExamDate(exam.exam_date)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        {exam.exam_type === 'written' ? 'Written' : 'MCQ'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <AdminSectionTitle title="This Week's Activity" barColor="bg-pink-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl shadow-sm bg-white p-4 border border-gray-100">
                <p className="text-xs text-gray-500">Announcements posted this week</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {adminWeekActivity.announcementCount}
                </p>
                {adminWeekActivity.lastAnnouncementTitle ? (
                  <p className="text-xs text-gray-600 mt-2 truncate">
                    Latest: {adminWeekActivity.lastAnnouncementTitle}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No announcements this week</p>
                )}
              </div>
              <div className="rounded-xl shadow-sm bg-white p-4 border border-gray-100">
                <p className="text-xs text-gray-500">Exams graded this week</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {adminWeekActivity.gradedExamsCount}
                </p>
              </div>
            </div>
          </div>

          {/* ZONE 3 — Institute Overview */}
          <div className="flex flex-col gap-5">
            <AdminZoneHeader label="Institute Overview" barColor="bg-indigo-500" />

            <AdminSectionTitle title="Stats" barColor="bg-blue-500" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <AdminStatCard
                icon="👥"
                label="Total Students"
                value={adminStats.students}
                borderColor="border-t-blue-500"
                onClick={() => navigate('/students')}
              />
              <AdminStatCard
                icon="👨‍🏫"
                label="Total Teachers"
                value={adminStats.teachers}
                borderColor="border-t-green-500"
                onClick={() => navigate('/teachers')}
              />
              <AdminStatCard
                icon="🏫"
                label="Total Classes"
                value={adminStats.classes}
                borderColor="border-t-orange-500"
                onClick={() => navigate('/classes')}
              />
              <AdminStatCard
                icon="📊"
                label="Institute Avg Score"
                value={`${adminStats.avg}%`}
                borderColor="border-t-purple-500"
                onClick={() => navigate('/results')}
              />
              <AdminStatCard
                icon="📅"
                label="Classes with Attendance Today"
                value={`${adminStats.attendanceMarked}/${adminStats.attendanceTotal}`}
                borderColor="border-t-indigo-500"
                onClick={() => navigate('/attendance')}
              />
            </div>

            <AdminSectionTitle title="Best & Worst Class" barColor="bg-amber-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl shadow-sm bg-white p-4 border border-green-100 border-t-4 border-t-green-500">
                <p className="text-xs text-gray-500">🏆 Best</p>
                {adminBestClass ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 mt-1">{adminBestClass.name}</p>
                    <p className="text-sm text-green-600 font-medium mt-1">{adminBestClass.avg}% avg</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">No score data yet</p>
                )}
              </div>
              <div className="rounded-xl shadow-sm bg-white p-4 border border-orange-100 border-t-4 border-t-orange-500">
                <p className="text-xs text-gray-500">⚠️ Needs Attention</p>
                {adminWorstClass ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 mt-1">{adminWorstClass.name}</p>
                    <p className="text-sm text-orange-600 font-medium mt-1">{adminWorstClass.avg}% avg</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">No score data yet</p>
                )}
              </div>
            </div>

            <AnnouncementsSection announcements={recentAnnouncements} navigate={navigate} />
          </div>
        </>
      )}

      {(userRole === 'student' || userRole === 'parent' || userRole === 'teacher') && (
        <AnnouncementsSection announcements={recentAnnouncements} navigate={navigate} />
      )}
    </div>
  )
}
