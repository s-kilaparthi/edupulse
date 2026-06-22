import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'
import { checkDateHolidayStatus, fetchHolidayData, todayISO } from '../utils/holidays'
import Loader from '../components/Loader'
import { useTheme } from '../context/ThemeContext'

function getInstituteSplashName(institute) {
  if (institute?.brand_name?.trim()) return institute.brand_name.trim()
  const words = (institute?.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0]} ${words[1]}`
  if (words.length === 1) return words[0]
  return 'Institute'
}

function getInstituteSplashLetter(institute) {
  const source = institute?.brand_name?.trim() || institute?.name?.trim() || 'I'
  return source.charAt(0).toUpperCase()
}

function InstituteSplash({ institute, fadingOut, isDark }) {
  const displayName = getInstituteSplashName(institute)
  const letter = getInstituteSplashLetter(institute)

  return (
    <div
      className={`fixed inset-0 z-[9999] flex min-h-screen flex-col items-center justify-center transition-opacity duration-500 ${
        isDark ? 'bg-[#000000]' : 'bg-white'
      } ${fadingOut ? 'splash-fade-out opacity-0' : 'splash-fade-in opacity-100'}`}
    >
      {institute?.logo_url ? (
        <img
          src={institute.logo_url}
          width={120}
          height={120}
          className="rounded-2xl object-cover mb-4"
          alt={displayName}
        />
      ) : (
        <div className="mb-4 flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-blue-600">
          <span className="text-5xl font-bold text-white">{letter}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">{displayName}</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-[#A8A8A8]">Welcome back!</p>
    </div>
  )
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const DISMISSED_PINNED_KEY = 'dismissedPinnedAnnouncements'

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
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function getWeekDateBounds() {
  const today = todayDateStr()
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  return { from: monday.toISOString().split('T')[0], to: today }
}

function extractGroupClasses(group) {
  const members = group?.class_group_members ?? []
  return members
    .map((m) => {
      const cls = m.classes
      if (!cls) return null
      return { id: m.class_id ?? cls.id, name: cls.name }
    })
    .filter(Boolean)
}

function getScorePctColor(pct) {
  if (pct >= 70) return 'text-green-600'
  if (pct >= 40) return 'text-orange-600'
  return 'text-red-600'
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
  const className = `rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 border-t-4 ${borderColor} ${
    onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 dark:border-gray-600 transition-all text-left w-full' : ''
  }`

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl">{icon}</span>
        {onClick && <span className="text-xs text-blue-600 font-medium shrink-0">→</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mt-2">{value}</p>
      <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">{label}</p>
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
      <h2 className="font-bold text-gray-800 dark:text-[#FFFFFF] text-base">{title}</h2>
    </div>
  )
}

function AdminZoneHeader({ label, barColor = 'bg-blue-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-6 ${barColor} rounded-full`} />
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#A8A8A8]">{label}</h2>
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

function getDismissedPinnedIds() {
  try {
    const raw = localStorage.getItem(DISMISSED_PINNED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function pickPinnedAnnouncement(announcements, dismissedIds) {
  return (announcements ?? [])
    .filter((a) => a.is_pinned && !dismissedIds.includes(a.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null
}

function formatPinnedBodyPreview(body, maxLen = 80) {
  if (!body) return ''
  if (body.length <= maxLen) return body
  return `${body.slice(0, maxLen)}...`
}

function StatCard({ label, value, sub, onClick, hint }) {
  const className = `rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm ${
    onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''
  }`

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">{label}</p>
        {hint && <span className="text-xs text-blue-600 font-medium shrink-0">{hint}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">{sub}</p>}
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
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
          📋 My Tasks ({pendingCount} pending)
        </span>
        <span className="text-xs text-gray-400 dark:text-[#A8A8A8] shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t-2 border-gray-200 dark:border-gray-700">
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
              className="flex-1 rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
            />
            <div className="flex flex-col shrink-0">
              <label className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Deadline</label>
              <input
                type="date"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                className="rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTask}
              disabled={saving || !taskTitle.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-shadow shrink-0"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-[#A8A8A8] text-center py-4">No tasks yet. Add one above! ✨</p>
          ) : (
            <ul className="space-y-2">
              {sortedTasks.map((task) => {
                const deadlineInfo = formatTaskDeadline(task.deadline, task.is_completed)
                return (
                  <li
                    key={task.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626] ${
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
                      className="rounded border-gray-300 dark:border-gray-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm text-gray-900 dark:text-[#FFFFFF] ${
                          task.is_completed ? 'line-through text-gray-500 dark:text-[#A8A8A8]' : ''
                        }`}
                      >
                        {task.title}
                      </p>
                      {deadlineInfo && (
                        <p
                          className={`text-xs mt-0.5 ${
                            deadlineInfo.overdue ? 'text-red-600 font-medium' : 'text-gray-500 dark:text-[#A8A8A8]'
                          }`}
                        >
                          {deadlineInfo.text}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-gray-400 dark:text-[#A8A8A8] hover:text-red-600 text-sm shrink-0 p-1"
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Recent Announcements</h2>
        <button
          type="button"
          onClick={() => navigate('/announcements')}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          View all
        </button>
      </div>
      {announcements.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No announcements yet.</p>
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
              a.is_pinned ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800' : 'bg-white dark:bg-[#1C1C1C] border-gray-200 dark:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {a.is_pinned && <span className="text-xs text-yellow-600">📌</span>}
              <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-sm">{a.title}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">
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
  const [adminBestGroup, setAdminBestGroup] = useState(null)
  const [adminWorstGroup, setAdminWorstGroup] = useState(null)
  const [adminGroupOverview, setAdminGroupOverview] = useState([])
  const [adminHasGroups, setAdminHasGroups] = useState(false)
  const [recentAnnouncements, setRecentAnnouncements] = useState([])
  const [pinnedAnnouncementBanner, setPinnedAnnouncementBanner] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState([])
  const [todayDayOff, setTodayDayOff] = useState({ isOff: false, type: null, name: null })
  const [todayAttendance, setTodayAttendance] = useState({
    status: 'not_marked',
    presentCount: 0,
    totalCount: 0,
  })
  const [teacherClassCards, setTeacherClassCards] = useState([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const [showInstituteSplash, setShowInstituteSplash] = useState(
    () => sessionStorage.getItem('institute_splash_shown') !== 'true'
  )
  const [instituteSplashFadingOut, setInstituteSplashFadingOut] = useState(false)
  const [instituteSplashData, setInstituteSplashData] = useState(null)
  const [instituteSplashReady, setInstituteSplashReady] = useState(false)

  useEffect(() => {
    if (!showInstituteSplash || !session?.user?.id) return

    async function loadInstituteSplash() {
      const { data: userData } = await supabase
        .from('users')
        .select('institute_id, role')
        .eq('id', session.user.id)
        .single()

      if (userData?.role === 'superadmin' || !userData?.institute_id) {
        sessionStorage.setItem('institute_splash_shown', 'true')
        setShowInstituteSplash(false)
        return
      }

      const { data: institute } = await supabase
        .from('institutes')
        .select('name, brand_name, logo_url')
        .eq('id', userData.institute_id)
        .single()

      setInstituteSplashData(institute)
      setInstituteSplashReady(true)
    }

    loadInstituteSplash()
  }, [session, showInstituteSplash])

  useEffect(() => {
    if (!showInstituteSplash || !instituteSplashReady) return

    const fadeOutTimer = setTimeout(() => setInstituteSplashFadingOut(true), 2000)
    const hideTimer = setTimeout(() => {
      sessionStorage.setItem('institute_splash_shown', 'true')
      setShowInstituteSplash(false)
    }, 2500)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(hideTimer)
    }
  }, [showInstituteSplash, instituteSplashReady])

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
      const dismissedPinnedIds = getDismissedPinnedIds()

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
            setTodayAttendance({ status: 'not_marked', presentCount: 0, totalCount: 0 })
            setPinnedAnnouncementBanner(null)
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

        const today = todayISO()
        const holidayData = instituteId ? await fetchHolidayData(instituteId) : { weeklyOff: [], holidays: [] }
        const dayOffStatus = checkDateHolidayStatus(today, holidayData.holidays, holidayData.weeklyOff)
        setTodayDayOff(dayOffStatus)

        if (studentClassId && !dayOffStatus.isOff) {
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

        const { data: attendanceRows } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', studentId)
          .eq('date', todayDateStr())

        const records = attendanceRows ?? []
        const totalCount = records.length
        const presentCount = records.filter((r) => r.status === 'present').length
        const hasPresent = presentCount > 0
        const allAbsent = totalCount > 0 && records.every((r) => r.status === 'absent')

        let attendanceStatus = 'not_marked'
        if (totalCount === 0) {
          attendanceStatus = 'not_marked'
        } else if (hasPresent) {
          attendanceStatus = 'present'
        } else if (allAbsent) {
          attendanceStatus = 'absent'
        }

        setTodayAttendance({ status: attendanceStatus, presentCount, totalCount })

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
        setPinnedAnnouncementBanner(pickPinnedAnnouncement(announcements, dismissedPinnedIds))
      } else if (userRole === 'teacher') {
        setRecentAnnouncements((announcementData ?? []).slice(0, 3))
        setPinnedAnnouncementBanner(
          pickPinnedAnnouncement(announcementData ?? [], dismissedPinnedIds)
        )

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
                .eq('institute_id', instituteId)
                .limit(1),
            ])

            return {
              ...cls,
              studentCount: studentCount ?? 0,
              attendanceMarked: (attendanceToday?.length ?? 0) > 0,
              groupNames: [],
            }
          })
        )

        const teacherClassIds = classCards.map((c) => c.classId)
        if (teacherClassIds.length > 0 && instituteId) {
          const { data: members } = await supabase
            .from('class_group_members')
            .select('class_id, class_groups(name)')
            .in('class_id', teacherClassIds)

          const groupNamesByClass = {}
          for (const m of members ?? []) {
            const name = m.class_groups?.name
            if (!name) continue
            if (!groupNamesByClass[m.class_id]) groupNamesByClass[m.class_id] = []
            if (!groupNamesByClass[m.class_id].includes(name)) {
              groupNamesByClass[m.class_id].push(name)
            }
          }

          for (const card of classCards) {
            card.groupNames = groupNamesByClass[card.classId] ?? []
          }
        }

        classCards.sort((a, b) => a.className.localeCompare(b.className))
        setTeacherClassCards(classCards)
      } else if (userRole === 'admin' && instituteId) {
        const today = todayDateStr()
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekAgoIso = weekAgo.toISOString()

        const [studentsRes, teachersRes, instituteRes, classRes, studentsForScores, groupsRes] =
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
            supabase
              .from('class_groups')
              .select('id, name, class_group_members(class_id, classes(id, name))')
              .eq('institute_id', instituteId)
              .order('name'),
          ])

        const classes = classRes.data ?? []
        const groups = groupsRes.data ?? []
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

        const weekBounds = getWeekDateBounds()
        let weekAttendance = []
        if (classIds.length > 0) {
          const { data: attendanceWeek } = await supabase
            .from('attendance')
            .select('class_id, status')
            .eq('institute_id', instituteId)
            .in('class_id', classIds)
            .gte('date', weekBounds.from)
            .lte('date', weekBounds.to)
          weekAttendance = attendanceWeek ?? []
        }

        let groupOverview = []
        let groupAvgs = []

        if (groups.length > 0) {
          groupOverview = groups.map((group) => {
            const groupClasses = extractGroupClasses(group)
            const groupClassIdSet = new Set(groupClasses.map((c) => c.id))
            const groupStudents = studentRows.filter((s) => s.class_id && groupClassIdSet.has(s.class_id))
            const groupStudentIds = new Set(groupStudents.map((s) => s.id))

            const groupPercentages = scoresData
              .filter((r) => r.percentage != null && groupStudentIds.has(r.student_id))
              .map((r) => r.percentage)

            const scorePct = groupPercentages.length > 0
              ? Math.round(groupPercentages.reduce((a, b) => a + b, 0) / groupPercentages.length)
              : 0

            const groupAttendance = weekAttendance.filter((r) => groupClassIdSet.has(r.class_id))
            const presentCount = groupAttendance.filter(
              (r) => r.status === 'present' || r.status === 'late'
            ).length
            const attendancePct = groupAttendance.length > 0
              ? Math.round((presentCount / groupAttendance.length) * 100)
              : 0

            return {
              id: group.id,
              name: group.name,
              sectionCount: groupClasses.length,
              studentCount: groupStudents.length,
              attendancePct,
              scorePct,
              hasScoreData: groupPercentages.length > 0,
            }
          })

          groupAvgs = groupOverview
            .filter((g) => g.hasScoreData)
            .map((g) => ({ id: g.id, name: g.name, avg: g.scorePct }))
            .sort((a, b) => b.avg - a.avg)
        }

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
        setAdminHasGroups(groups.length > 0)
        setAdminGroupOverview(groupOverview)
        setAdminBestGroup(groupAvgs[0] ?? null)
        setAdminWorstGroup(groupAvgs.length > 1 ? groupAvgs[groupAvgs.length - 1] : null)
        setRecentAnnouncements((announcementData ?? []).slice(0, 3))
        setPinnedAnnouncementBanner(null)
      }

      setLoading(false)
    }

    loadDashboard()
  }, [session, userLoaded, instituteId, userRole])

  if (showInstituteSplash) {
    if (!instituteSplashReady) {
      return (
        <div
          className={`fixed inset-0 z-[9999] flex min-h-screen items-center justify-center ${
            theme === 'dark' ? 'bg-[#000000]' : 'bg-white'
          }`}
        >
          <Loader size={40} />
        </div>
      )
    }

    return (
      <InstituteSplash
        institute={instituteSplashData}
        fadingOut={instituteSplashFadingOut}
        isDark={theme === 'dark'}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex justify-center items-center h-64">
          <Loader size={40} />
        </div>
      </div>
    )
  }

  const timeGreeting = getTimeGreeting()

  function dismissPinnedAnnouncement(announcementId) {
    const dismissed = getDismissedPinnedIds()
    if (!dismissed.includes(announcementId)) {
      localStorage.setItem(
        DISMISSED_PINNED_KEY,
        JSON.stringify([...dismissed, announcementId])
      )
    }
    setPinnedAnnouncementBanner(null)
  }

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {pinnedAnnouncementBanner
        && (userRole === 'student' || userRole === 'parent' || userRole === 'teacher') && (
        <div className="bg-blue-600 text-white px-4 py-3 rounded-xl mb-4 flex items-center gap-3">
          <p className="text-sm flex-1 min-w-0">
            📢 {pinnedAnnouncementBanner.title}:{' '}
            {formatPinnedBodyPreview(pinnedAnnouncementBanner.body)}
          </p>
          <button
            type="button"
            onClick={() => navigate('/announcements')}
            className="shrink-0 text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => dismissPinnedAnnouncement(pinnedAnnouncementBanner.id)}
            className="shrink-0 text-white/80 hover:text-white text-sm leading-none px-1"
            aria-label="Dismiss announcement"
          >
            ✕
          </button>
        </div>
      )}
      {(userRole === 'student' || userRole === 'parent') && (
        <>
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-[#1C1C1C] dark:to-[#262626] p-5 shadow-sm">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">
              {getRoleTimeGreeting(userRole === 'parent' ? parentName : userName)}
            </h1>
            {instituteName && (
              <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
            )}
            {userRole === 'parent' ? (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-current font-medium">
                👨‍👩‍👧 Parent · Viewing: {studentInfo.studentName ?? 'Student'}
              </span>
            ) : (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-current font-medium">
                🎓 Student
              </span>
            )}
            {userRole === 'student' && (
              <div className="flex flex-wrap gap-3 mt-2">
                {studentInfo.className && (
                  <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full border border-current font-medium">
                    📚 {studentInfo.className}
                  </span>
                )}
                {studentInfo.rollNo && (
                  <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full border border-current font-medium">
                    🎓 Roll #{studentInfo.rollNo}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Today&apos;s Schedule</h2>
              <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">{formatTodayDate()}</span>
            </div>
            {todayDayOff.isOff ? (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-4 py-6 text-center font-medium">
                {todayDayOff.type === 'holiday'
                  ? `Holiday — ${todayDayOff.name}`
                  : 'Weekly Holiday'}
              </div>
            ) : todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No classes scheduled today</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0">
                {todaySchedule.map((slot, index) => (
                  <div
                    key={slot.period_number}
                    className="flex rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 min-w-[160px] shrink-0 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div
                      className={`w-1 shrink-0 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                    />
                    <div className="pl-3 flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Period {slot.period_number}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] whitespace-nowrap">
                        {formatTime12(slot.start_time)} –{' '}
                        {formatTime12(getPeriodEndTime(slot.period_number, slot.start_time))}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">
                        {slot.subjects?.name ?? 'Subject'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8] truncate">
                        👤 {slot.users?.name ?? 'Teacher'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-green-500 rounded-full border border-current" />
              <h2 className="font-bold text-gray-800 dark:text-[#FFFFFF] text-base">Today&apos;s Attendance</h2>
            </div>
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                todayAttendance.status === 'present'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : todayAttendance.status === 'absent'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                    : 'bg-gray-50 dark:bg-[#262626] border-gray-200 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
              }`}
            >
              <p className="text-lg font-semibold">
                {todayAttendance.status === 'present' && '✅ Present'}
                {todayAttendance.status === 'absent' && '❌ Absent'}
                {todayAttendance.status === 'not_marked' && '🕐 Not Marked Yet'}
              </p>
              <p className="text-sm mt-2 opacity-90">
                {todayAttendance.totalCount === 0
                  ? 'No attendance recorded today'
                  : `Present in ${todayAttendance.presentCount} out of ${todayAttendance.totalCount} periods today`}
              </p>
            </div>
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
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-[#1C1C1C] dark:to-[#262626] p-5 shadow-sm">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">
              {getRoleTimeGreeting(userName)}
            </h1>
            {instituteName && (
              <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
            )}
            <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-current font-medium">
              👨‍🏫 Teacher
            </span>
          </div>

          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-blue-500 rounded-full border border-current" />
                <h2 className="font-bold text-gray-800 dark:text-[#FFFFFF] text-base">Today&apos;s Schedule</h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">{formatTodayDate()}</span>
            </div>
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No classes scheduled today</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0">
                {todaySchedule.map((slot, index) => (
                  <div
                    key={`${slot.period_number}-${index}`}
                    className="flex rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 min-w-[160px] shrink-0 border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div
                      className={`w-1 shrink-0 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                    />
                    <div className="pl-3 flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Period {slot.period_number}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] whitespace-nowrap">
                        {formatTime12(slot.start_time)} –{' '}
                        {formatTime12(
                          slot.end_time?.slice(0, 5) ??
                            getPeriodEndTime(slot.period_number, slot.start_time)
                        )}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">
                        {slot.subjects?.name ?? 'Subject'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8] truncate">
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
                <div className="w-1 h-5 bg-purple-500 rounded-full border border-current" />
                <h2 className="font-bold text-gray-800 dark:text-[#FFFFFF] text-base">My Classes</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
              {teacherClassCards.map((cls, index) => (
                <div
                  key={cls.classId}
                  className={`rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-3 border-2 border-gray-200 dark:border-gray-700 border-t-4 ${CLASS_CARD_TOP_BORDERS[index % CLASS_CARD_TOP_BORDERS.length]} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm truncate">{cls.className}</p>
                      {cls.groupNames?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cls.groupNames.map((groupName) => (
                            <span
                              key={groupName}
                              className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full"
                            >
                              {groupName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {cls.attendanceMarked ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/attendance', {
                            state: { autoSelectClassId: cls.classId, autoTab: 'mark' },
                          })
                        }
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-current font-medium shrink-0 hover:bg-green-200 cursor-pointer transition-colors"
                      >
                        ✅ Marked
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/attendance', {
                            state: { autoSelectClassId: cls.classId, autoTab: 'mark' },
                          })
                        }
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-current font-medium shrink-0 hover:bg-orange-200 cursor-pointer transition-colors"
                      >
                        ⚠️ Pending
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-2 line-clamp-2">
                    {cls.subjects.length > 0 ? cls.subjects.join(', ') : 'No subjects assigned'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#A8A8A8]">👥 {cls.studentCount} Students</p>
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

            <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-[#1C1C1C] dark:to-[#262626] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">
                    {timeGreeting.text}, Admin! {timeGreeting.emoji}
                  </h1>
                  {instituteName && (
                    <p className="text-sm text-indigo-700 font-medium mt-1">{instituteName}</p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-[#A8A8A8] mt-2">
                    {adminStats.students} Students · {adminStats.teachers} Teachers · {adminStats.classes} Classes
                  </p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 rounded-full border border-current px-2 py-0.5 font-medium shrink-0">
                  Admin
                </span>
              </div>
            </div>

            <AdminSectionTitle title="Today's Attendance" barColor="bg-green-500" />
            {adminAttendanceClasses.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No classes in this institute yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {adminAttendanceClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-3 border-2 border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm truncate">{cls.name}</p>
                      {cls.marked ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/attendance', {
                              state: { autoSelectClassId: cls.id, autoTab: 'mark' },
                            })
                          }
                          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-current font-medium shrink-0 hover:bg-green-200 cursor-pointer transition-colors"
                        >
                          ✅ Marked
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/attendance', {
                              state: { autoSelectClassId: cls.id, autoTab: 'mark' },
                            })
                          }
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-current font-medium shrink-0 hover:bg-orange-200 cursor-pointer transition-colors"
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

            {adminHasGroups && (
              <>
                <AdminSectionTitle title="Group Overview" barColor="bg-amber-500" />
                {adminGroupOverview.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {adminGroupOverview.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => navigate('/results', { state: { tab: 'reports', groupId: group.id } })}
                        className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-3 border-2 border-gray-200 dark:border-gray-700 text-left hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                      >
                        <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm truncate">{group.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">
                          {group.sectionCount} Sections · {group.studentCount} Students
                        </p>
                        <p className="text-xs text-gray-600 dark:text-[#A8A8A8] mt-1">
                          Attendance: {group.attendancePct}% this week
                        </p>
                        <p className={`text-sm font-bold mt-1 ${getScorePctColor(group.scorePct)}`}>
                          Avg Score: {group.scorePct}%
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <AdminSectionTitle title="Today's Exams" barColor="bg-orange-500" />
            {adminTodayExams.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No exams scheduled today</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {adminTodayExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-3 border-2 border-gray-200 dark:border-gray-700"
                  >
                    <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">{exam.name}</p>
                    <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">{formatExamClassLabel(exam)}</p>
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
                    className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-3 border border-orange-100 border-l-4 border-l-orange-400"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">{exam.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] font-medium">
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
              <div className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 border-2 border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Announcements posted this week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">
                  {adminWeekActivity.announcementCount}
                </p>
                {adminWeekActivity.lastAnnouncementTitle ? (
                  <p className="text-xs text-gray-600 dark:text-[#A8A8A8] mt-2 truncate">
                    Latest: {adminWeekActivity.lastAnnouncementTitle}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-2">No announcements this week</p>
                )}
              </div>
              <div className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 border-2 border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Exams graded this week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">
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

            <AdminSectionTitle
              title={adminHasGroups ? 'Best & Worst Group' : 'Best & Worst Class'}
              barColor="bg-amber-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 border border-green-100 border-t-4 border-t-green-500">
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                  {adminHasGroups ? '🏆 Best Group' : '🏆 Best'}
                </p>
                {adminHasGroups ? (
                  adminBestGroup ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">{adminBestGroup.name}</p>
                      <p className="text-sm text-green-600 font-medium mt-1">{adminBestGroup.avg}% avg</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-[#A8A8A8] mt-2">No score data yet</p>
                  )
                ) : adminBestClass ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">{adminBestClass.name}</p>
                    <p className="text-sm text-green-600 font-medium mt-1">{adminBestClass.avg}% avg</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8] mt-2">No score data yet</p>
                )}
              </div>
              <div className="rounded-xl shadow-sm bg-white dark:bg-[#1C1C1C] p-4 border border-orange-100 border-t-4 border-t-orange-500">
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">⚠️ Needs Attention</p>
                {adminHasGroups ? (
                  adminWorstGroup ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">{adminWorstGroup.name}</p>
                      <p className="text-sm text-orange-600 font-medium mt-1">{adminWorstGroup.avg}% avg</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-[#A8A8A8] mt-2">No score data yet</p>
                  )
                ) : adminWorstClass ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF] mt-1">{adminWorstClass.name}</p>
                    <p className="text-sm text-orange-600 font-medium mt-1">{adminWorstClass.avg}% avg</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8] mt-2">No score data yet</p>
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
