import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'
import {
  extractGroupClasses,
  filterClassesByGroup,
  fetchTeacherClassesAndGroups,
} from '../utils/teacherGroups'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const STATUS_OPTIONS = ['present', 'absent', 'late']
const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700 border-green-300',
  absent: 'bg-red-100 text-red-700 border-red-300',
  late: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}
const STATUS_ICONS = { present: '✅', absent: '❌', late: '🕐' }

const ADMIN_TABS = [
  { id: 'mark', label: 'Mark Attendance' },
  { id: 'reports', label: 'Reports' },
  { id: 'student', label: 'Student Report' },
]

const TEACHER_TABS = [
  { id: 'mark', label: 'Mark Attendance' },
  { id: 'reports', label: 'Reports' },
  { id: 'student', label: 'Student Report' },
]

function getDayName(dateStr) {
  return DAYS[new Date(dateStr + 'T00:00:00').getDay()]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function getGroupDateBounds(range) {
  const today = todayStr()
  if (range === 'today') return { from: today, to: today }
  if (range === 'week') {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(d)
    monday.setDate(d.getDate() - diff)
    return { from: monday.toISOString().split('T')[0], to: today }
  }
  const d = new Date()
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return { from: first.toISOString().split('T')[0], to: today }
}

function getAttendancePctColor(pct) {
  if (pct >= 75) {
    return {
      text: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    }
  }
  if (pct >= 50) {
    return {
      text: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    }
  }
  return {
    text: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  }
}

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function attendanceNotificationBody(status, subjectName, dateStr) {
  const dateLabel = formatDateDDMMYYYY(dateStr)
  if (status === 'absent') {
    return `You were marked Absent for ${subjectName} on ${dateLabel}`
  }
  if (status === 'late') {
    return `You were marked Late for ${subjectName} on ${dateLabel}`
  }
  return `You were marked Present for ${subjectName} on ${dateLabel}`
}

async function sendAttendanceNotifications({ students, attendanceMap, slot, date, instituteId }) {
  const subjectName = slot.subjects?.name ?? 'your subject'
  const notifRows = []

  for (const student of students) {
    const status = attendanceMap[student.id] ?? 'present'
    const title = `Attendance Marked — ${subjectName}`
    const body = attendanceNotificationBody(status, subjectName, date)

    const { data: studentUser } = await supabase
      .from('users')
      .select('id, roll_number')
      .eq('id', student.id)
      .single()

    if (!studentUser?.id) continue

    notifRows.push({
      user_id: studentUser.id,
      title,
      body,
      type: 'attendance',
      is_read: false,
    })

    if (instituteId && studentUser.roll_number != null && studentUser.roll_number !== '') {
      const { data: parent } = await supabase
        .from('users')
        .select('id')
        .eq('roll_number', String(studentUser.roll_number))
        .eq('role', 'parent')
        .eq('institute_id', instituteId)
        .limit(1)
        .maybeSingle()

      if (parent?.id) {
        notifRows.push({
          user_id: parent.id,
          title,
          body,
          type: 'attendance',
          is_read: false,
        })
      }
    }
  }

  if (notifRows.length > 0) {
    const { error: notifError } = await supabase.from('notifications').insert(notifRows)
    if (notifError) console.error('Attendance notification error:', notifError)
  }
}

function StudentList({
  students,
  attendanceMap,
  setAttendanceMap,
  onSave,
  saving,
}) {
  return (
    <div className="border-t-2 border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex items-center justify-between min-h-[60px] py-3 border-b border-gray-50 last:border-0 gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-[#FFFFFF]">{student.name}</p>
              <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">Roll #{student.roll_number}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setAttendanceMap((prev) => ({ ...prev, [student.id]: status }))
                  }
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-w-[44px] flex items-center justify-center ${
                    attendanceMap[student.id] === status
                      ? STATUS_COLORS[status]
                      : 'bg-gray-50 dark:bg-[#262626] text-gray-400 dark:text-[#A8A8A8] border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {STATUS_ICONS[status]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
          {Object.values(attendanceMap).filter((s) => s === 'present').length} present ·{' '}
          {Object.values(attendanceMap).filter((s) => s === 'absent').length} absent ·{' '}
          {Object.values(attendanceMap).filter((s) => s === 'late').length} late
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-green-600 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Attendance'}
        </button>
      </div>
    </div>
  )
}

function SlotCard({
  slot,
  isSaved,
  isActive,
  onToggle,
  students,
  attendanceMap,
  setAttendanceMap,
  onSave,
  saving,
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold text-gray-900 dark:text-[#FFFFFF]">
            {slot.subjects?.name} — {slot.classes?.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-0.5">
            Period {slot.period_number} · {slot.start_time?.slice(0, 5)} -{' '}
            {slot.end_time?.slice(0, 5)}
          </p>
        </div>
        {isSaved ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full border border-current font-medium hover:bg-green-200"
          >
            {isActive ? 'Cancel' : '✓ Marked · Edit'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {isActive ? 'Cancel' : 'Mark Attendance'}
          </button>
        )}
      </div>

      {isActive && students.length > 0 && (
        <StudentList
          students={students}
          attendanceMap={attendanceMap}
          setAttendanceMap={setAttendanceMap}
          onSave={onSave}
          saving={saving}
        />
      )}
      {isActive && students.length === 0 && (
        <div className="border-t-2 border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No students in this class.</p>
        </div>
      )}
    </div>
  )
}

export default function Attendance() {
  const { session } = useOutletContext()

  const [userRole, setUserRole] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [todaySlots, setTodaySlots] = useState([])
  const [activeSlotId, setActiveSlotId] = useState(null)
  const [students, setStudents] = useState([])
  const [attendanceMap, setAttendanceMap] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedSlots, setSavedSlots] = useState(new Set())
  const [classes, setClasses] = useState([])
  const [classGroups, setClassGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupDateRange, setGroupDateRange] = useState('week')
  const [groupSummary, setGroupSummary] = useState(null)
  const [sectionStats, setSectionStats] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [studentSummary, setStudentSummary] = useState({})
  const [studentRecordsBySubject, setStudentRecordsBySubject] = useState({})
  const [expandedStudentSubject, setExpandedStudentSubject] = useState(null)
  const [adminTab, setAdminTab] = useState('mark')
  const [reportFromDate, setReportFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [reportToDate, setReportToDate] = useState(todayStr())
  const [reportRows, setReportRows] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportClassId, setReportClassId] = useState('')
  const [reportStudentId, setReportStudentId] = useState('')
  const [reportStudents, setReportStudents] = useState([])
  const [studentAttendance, setStudentAttendance] = useState([])
  const [teacherReportClasses, setTeacherReportClasses] = useState([])
  const [teacherClassGroups, setTeacherClassGroups] = useState([])
  const [teacherSelectedGroupId, setTeacherSelectedGroupId] = useState('')
  const [teacherTab, setTeacherTab] = useState('mark')
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState('')

  const isTeacher = userRole === 'teacher'
  const isStudent = userRole === 'student'
  const isParent = userRole === 'parent'
  const isStudentView = isStudent || isParent
  const isAdmin = userRole === 'admin'
  const [effectiveStudentId, setEffectiveStudentId] = useState(null)

  const displayClasses = useMemo(
    () => filterClassesByGroup(classes, selectedGroupId, classGroups),
    [classes, selectedGroupId, classGroups]
  )

  const selectedGroup = useMemo(
    () => classGroups.find((g) => g.id === selectedGroupId) ?? null,
    [classGroups, selectedGroupId]
  )

  const groupClasses = useMemo(
    () => extractGroupClasses(selectedGroup),
    [selectedGroup]
  )

  const teacherDisplayClasses = useMemo(
    () => filterClassesByGroup(teacherReportClasses, teacherSelectedGroupId, teacherClassGroups),
    [teacherReportClasses, teacherSelectedGroupId, teacherClassGroups]
  )

  const teacherSelectedGroup = useMemo(
    () => teacherClassGroups.find((g) => g.id === teacherSelectedGroupId) ?? null,
    [teacherClassGroups, teacherSelectedGroupId]
  )

  const teacherGroupClasses = useMemo(
    () => extractGroupClasses(teacherSelectedGroup),
    [teacherSelectedGroup]
  )

  useEffect(() => {
    if (!session?.user?.id) return

    supabase
      .from('users')
      .select('role, institute_id, roll_number')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setUserRole(data.role)
          setInstituteId(data.institute_id)
          setUserId(session.user.id)

          if (data.role === 'parent') {
            const linkedStudent = await fetchLinkedStudent(data)
            setEffectiveStudentId(linkedStudent?.id ?? null)
          } else if (data.role === 'student') {
            setEffectiveStudentId(session.user.id)
          }
        }
      })
  }, [session])

  useEffect(() => {
    if (!instituteId || !isAdmin) return

    Promise.all([
      supabase
        .from('classes')
        .select('id, name')
        .eq('institute_id', instituteId)
        .order('name'),
      supabase
        .from('class_groups')
        .select('id, name, class_group_members(class_id, classes(id, name))')
        .eq('institute_id', instituteId)
        .order('name'),
    ]).then(([classesRes, groupsRes]) => {
      setClasses(classesRes.data ?? [])
      setClassGroups(groupsRes.data ?? [])
    })
  }, [instituteId, isAdmin])

  useEffect(() => {
    if (!isAdmin || !selectedGroupId) return
    const visibleIds = new Set(displayClasses.map((c) => c.id))
    if (selectedClassId && !visibleIds.has(selectedClassId)) {
      setSelectedClassId('')
    }
  }, [isAdmin, selectedGroupId, displayClasses, selectedClassId])

  useEffect(() => {
    if (!userId || !isTeacher || !instituteId) return

    fetchTeacherClassesAndGroups(userId, instituteId).then(({ classes, groups }) => {
      setTeacherReportClasses(classes)
      setTeacherClassGroups(groups)
    })
  }, [userId, isTeacher, instituteId])

  useEffect(() => {
    if (!isTeacher || !teacherSelectedGroupId) return
    if (selectedClassId && !teacherDisplayClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId('')
    }
  }, [isTeacher, teacherSelectedGroupId, selectedClassId, teacherDisplayClasses])

  useEffect(() => {
    if (!reportClassId) {
      setReportStudents([])
      setReportStudentId('')
      return
    }

    supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('role', 'student')
      .eq('class_id', reportClassId)
      .order('roll_number')
      .then(({ data }) => setReportStudents(data ?? []))
  }, [reportClassId])

  useEffect(() => {
    if (!reportStudentId || !instituteId) {
      setStudentAttendance([])
      return
    }

    supabase
      .from('attendance')
      .select(
        'date, status, subject_id, subjects(name), schedule_slot_id, schedule_slots(period_number, start_time)'
      )
      .eq('student_id', reportStudentId)
      .eq('institute_id', instituteId)
      .order('date', { ascending: false })
      .then(({ data }) => setStudentAttendance(data ?? []))
  }, [reportStudentId, instituteId])

  const fetchSavedSlots = useCallback(
    async (slotIds, forTeacher = true) => {
      if (!selectedDate || slotIds.length === 0) {
        setSavedSlots(new Set())
        return
      }

      let query = supabase
        .from('attendance')
        .select('schedule_slot_id')
        .eq('date', selectedDate)
        .in('schedule_slot_id', slotIds)

      if (forTeacher && userId) {
        query = query.eq('marked_by', userId)
      }

      const { data } = await query
      setSavedSlots(new Set(data?.map((a) => a.schedule_slot_id) ?? []))
    },
    [selectedDate, userId]
  )

  const fetchTeacherSlots = useCallback(async () => {
    if (!userId || !instituteId || !selectedDate) return

    setLoading(true)
    setError(null)

    const dayName = getDayName(selectedDate)

    const { data, error: fetchError } = await supabase
      .from('schedule_slots')
      .select(
        'id, class_id, subject_id, period_number, start_time, end_time, teacher_id, classes(name), subjects(name)'
      )
      .eq('teacher_id', userId)
      .eq('day_of_week', dayName)
      .eq('institute_id', instituteId)
      .order('period_number')

    if (fetchError) {
      setError(fetchError.message)
      setTodaySlots([])
    } else {
      const slots = data ?? []
      setTodaySlots(slots)
      await fetchSavedSlots(slots.map((s) => s.id), true)
    }

    setLoading(false)
  }, [userId, instituteId, selectedDate, fetchSavedSlots])

  const fetchAdminSlots = useCallback(async () => {
    if (!instituteId || !selectedDate) {
      setTodaySlots([])
      return
    }

    let classIds = []
    if (selectedClassId) {
      classIds = [selectedClassId]
    } else if (selectedGroupId && groupClasses.length > 0) {
      classIds = groupClasses.map((c) => c.id)
    } else {
      setTodaySlots([])
      return
    }

    setLoading(true)
    setError(null)

    const dayName = getDayName(selectedDate)

    const { data, error: fetchError } = await supabase
      .from('schedule_slots')
      .select(
        'id, class_id, subject_id, period_number, start_time, end_time, teacher_id, classes(name), subjects(name)'
      )
      .in('class_id', classIds)
      .eq('day_of_week', dayName)
      .eq('institute_id', instituteId)
      .order('period_number')

    if (fetchError) {
      setError(fetchError.message)
      setTodaySlots([])
    } else {
      const slots = data ?? []
      setTodaySlots(slots)
      await fetchSavedSlots(slots.map((s) => s.id), false)
    }

    setLoading(false)
  }, [instituteId, selectedDate, selectedClassId, selectedGroupId, groupClasses, fetchSavedSlots])

  useEffect(() => {
    if (!userId || !instituteId) return
    if (isTeacher) fetchTeacherSlots()
  }, [isTeacher, userId, instituteId, selectedDate, fetchTeacherSlots])

  useEffect(() => {
    if (!instituteId || !isAdmin || adminTab !== 'mark') return
    const hasScope = selectedClassId || (selectedGroupId && groupClasses.length > 0)
    if (hasScope) fetchAdminSlots()
    else setTodaySlots([])
  }, [isAdmin, adminTab, selectedClassId, selectedGroupId, groupClasses, instituteId, selectedDate, fetchAdminSlots])

  useEffect(() => {
    if (!instituteId || !isStudentView || !effectiveStudentId) return

    setLoading(true)

    supabase
      .from('attendance')
      .select('status, date, subject_id, subjects(name)')
      .eq('student_id', effectiveStudentId)
      .eq('institute_id', instituteId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        const subjectMap = {}
        const recordsMap = {}
        for (const row of data ?? []) {
          const sname = row.subjects?.name ?? 'Unknown'
          if (!subjectMap[sname]) subjectMap[sname] = { present: 0, total: 0 }
          if (!recordsMap[sname]) recordsMap[sname] = []
          subjectMap[sname].total += 1
          if (row.status === 'present' || row.status === 'late') {
            subjectMap[sname].present += 1
          }
          recordsMap[sname].push({ date: row.date, status: row.status })
        }
        for (const sname of Object.keys(recordsMap)) {
          recordsMap[sname].sort((a, b) => b.date.localeCompare(a.date))
        }
        setStudentSummary(subjectMap)
        setStudentRecordsBySubject(recordsMap)
        setLoading(false)
      })
  }, [instituteId, isStudentView, effectiveStudentId])

  async function fetchStudentsForSlot(slot) {
    const { data } = await supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('role', 'student')
      .eq('class_id', slot.class_id)
      .order('roll_number')

    setStudents(data ?? [])

    const map = {}
    data?.forEach((s) => {
      map[s.id] = 'present'
    })

    const { data: existing } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('schedule_slot_id', slot.id)
      .eq('date', selectedDate)

    existing?.forEach((a) => {
      map[a.student_id] = a.status
    })

    setAttendanceMap(map)
  }

  async function handleSaveAttendance(slot) {
    if (!slot || !userId || !instituteId) return

    setSaving(true)
    setError(null)

    const rows = students.map((s) => ({
      schedule_slot_id: slot.id,
      student_id: s.id,
      class_id: slot.class_id,
      subject_id: slot.subject_id,
      teacher_id: slot.teacher_id ?? userId,
      institute_id: instituteId,
      date: selectedDate,
      status: attendanceMap[s.id] ?? 'present',
      marked_by: userId,
    }))

    const { error: saveError } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'schedule_slot_id,student_id,date' })

    if (saveError) {
      setError(saveError.message)
    } else {
      setSavedSlots((prev) => new Set([...prev, slot.id]))
      setActiveSlotId(null)
      try {
        await sendAttendanceNotifications({
          students,
          attendanceMap,
          slot,
          date: selectedDate,
          instituteId,
        })
      } catch (notifErr) {
        console.error('Attendance notification error:', notifErr)
      }
    }

    setSaving(false)
  }

  function buildReportRows(classStudents, records) {
    const agg = {}
    for (const s of classStudents) {
      agg[s.id] = {
        name: s.name,
        roll_number: s.roll_number,
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
      }
    }

    for (const r of records) {
      if (!agg[r.student_id]) continue
      agg[r.student_id].total += 1
      if (r.status === 'present') agg[r.student_id].present += 1
      else if (r.status === 'absent') agg[r.student_id].absent += 1
      else if (r.status === 'late') agg[r.student_id].late += 1
    }

    return Object.values(agg).map((row) => {
      const counted = row.present + row.late
      const pct = row.total > 0 ? Math.round((counted / row.total) * 100) : 0
      return { ...row, pct }
    })
  }

  function buildSectionStats(classStudents, records, groupClassList) {
    const enrolledByClass = {}
    for (const s of classStudents) {
      enrolledByClass[s.class_id] = (enrolledByClass[s.class_id] ?? 0) + 1
    }

    const statsByClass = {}
    for (const cls of groupClassList) {
      statsByClass[cls.id] = {
        id: cls.id,
        name: cls.name,
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
        enrolled: enrolledByClass[cls.id] ?? 0,
      }
    }

    for (const r of records) {
      if (!statsByClass[r.class_id]) continue
      statsByClass[r.class_id].total += 1
      if (r.status === 'present') statsByClass[r.class_id].present += 1
      else if (r.status === 'absent') statsByClass[r.class_id].absent += 1
      else if (r.status === 'late') statsByClass[r.class_id].late += 1
    }

    return Object.values(statsByClass)
      .map((row) => {
        const counted = row.present + row.late
        const pct = row.total > 0 ? Math.round((counted / row.total) * 100) : 0
        return { ...row, pct, presentTotal: counted }
      })
      .sort((a, b) => b.pct - a.pct)
  }

  async function fetchScopedGroupReports(scopeClasses, activeGroupId, activeGroupName, classIdFilter) {
    if (!activeGroupId || !instituteId || scopeClasses.length === 0) {
      setGroupSummary(null)
      setSectionStats([])
      setReportRows([])
      return
    }

    setReportLoading(true)
    setError(null)

    const { from, to } = getGroupDateBounds(groupDateRange)
    const scopeClassIds = scopeClasses.map((c) => c.id)

    const [studentsRes, attendanceRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, roll_number, class_id')
        .eq('role', 'student')
        .in('class_id', scopeClassIds)
        .order('roll_number'),
      supabase
        .from('attendance')
        .select('student_id, class_id, status')
        .in('class_id', scopeClassIds)
        .gte('date', from)
        .lte('date', to),
    ])

    const allStudents = studentsRes.data ?? []
    const allRecords = attendanceRes.data ?? []

    let groupPresent = 0
    for (const r of allRecords) {
      if (r.status === 'present' || r.status === 'late') groupPresent += 1
    }

    const groupPct = allRecords.length > 0
      ? Math.round((groupPresent / allRecords.length) * 100)
      : 0

    setGroupSummary({
      name: activeGroupName ?? 'Group',
      present: groupPresent,
      total: allRecords.length,
      pct: groupPct,
      from,
      to,
    })

    setSectionStats(buildSectionStats(allStudents, allRecords, scopeClasses))

    const tableClassIds = classIdFilter
      ? new Set([classIdFilter])
      : new Set(scopeClassIds)
    const tableStudents = allStudents.filter((s) => tableClassIds.has(s.class_id))
    const tableRecords = allRecords.filter((r) => tableClassIds.has(r.class_id))
    setReportRows(buildReportRows(tableStudents, tableRecords))

    setReportLoading(false)
  }

  async function fetchGroupReports() {
    await fetchScopedGroupReports(
      groupClasses,
      selectedGroupId,
      selectedGroup?.name,
      selectedClassId || null
    )
  }

  async function fetchTeacherGroupReports() {
    await fetchScopedGroupReports(
      teacherDisplayClasses,
      teacherSelectedGroupId,
      teacherSelectedGroup?.name,
      selectedClassId || null
    )
  }

  async function fetchReports() {
    if (isAdmin && selectedGroupId) {
      await fetchGroupReports()
      return
    }

    if (isTeacher && teacherSelectedGroupId) {
      await fetchTeacherGroupReports()
      return
    }

    if (!selectedClassId || !reportFromDate || !reportToDate) return

    setReportLoading(true)
    setError(null)

    const [studentsRes, attendanceRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, roll_number')
        .eq('role', 'student')
        .eq('class_id', selectedClassId)
        .order('roll_number'),
      supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', selectedClassId)
        .gte('date', reportFromDate)
        .lte('date', reportToDate),
    ])

    setReportRows(buildReportRows(studentsRes.data ?? [], attendanceRes.data ?? []))
    setReportLoading(false)
  }

  useEffect(() => {
    if (!isAdmin || adminTab !== 'reports') return
    if (!selectedGroupId) {
      setGroupSummary(null)
      setSectionStats([])
      return
    }
    if (groupClasses.length === 0) return
    fetchGroupReports()
  }, [isAdmin, adminTab, selectedGroupId, groupDateRange, selectedClassId, groupClasses, instituteId])

  useEffect(() => {
    if (!isTeacher || teacherTab !== 'reports') return
    if (!teacherSelectedGroupId) {
      setGroupSummary(null)
      setSectionStats([])
      return
    }
    if (teacherDisplayClasses.length === 0) return
    fetchTeacherGroupReports()
  }, [isTeacher, teacherTab, teacherSelectedGroupId, groupDateRange, selectedClassId, teacherDisplayClasses, instituteId])

  function handleSlotToggle(slot) {
    const isActive = activeSlotId === slot.id
    setActiveSlotId(isActive ? null : slot.id)
    if (!isActive) fetchStudentsForSlot(slot)
  }

  function renderStudentReport(classList) {
    const present = studentAttendance.filter((a) => a.status === 'present').length
    const absent = studentAttendance.filter((a) => a.status === 'absent').length
    const late = studentAttendance.filter((a) => a.status === 'late').length
    const total = studentAttendance.length
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    return (
      <>
        <div className="flex gap-3 mb-4">
          <select
            value={reportClassId}
            onChange={(e) => {
              setReportClassId(e.target.value)
              setReportStudentId('')
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="">Select class...</option>
            {classList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {reportStudents.length > 0 && (
            <select
              value={reportStudentId}
              onChange={(e) => setReportStudentId(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select student...</option>
              {reportStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_number} — {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {reportStudentId && (
          <>
            <div className="flex flex-wrap gap-3 mb-4 p-4 bg-gray-50 dark:bg-[#262626] rounded-xl">
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-lg">✅</span>
                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Present</span>
                <span className="text-sm font-semibold text-green-600">{present}</span>
              </div>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-lg">❌</span>
                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Absent</span>
                <span className="text-sm font-semibold text-red-600">{absent}</span>
              </div>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-lg">🕐</span>
                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Late</span>
                <span className="text-sm font-semibold text-yellow-600">{late}</span>
              </div>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Overall</span>
                <span className={`text-sm font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                  {pct}%{pct < 75 && ' ⚠️'}
                </span>
              </div>
            </div>

            {studentAttendance.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No attendance records for this student.</p>
            ) : (
              <div className="overflow-x-auto bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#262626] text-left">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-[#A8A8A8]">Date</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-[#A8A8A8]">Subject</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-[#A8A8A8]">Period</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-[#A8A8A8]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAttendance.map((a, i) => (
                      <tr key={i} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262626]">
                        <td className="px-3 py-2">{a.date}</td>
                        <td className="px-3 py-2">{a.subjects?.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-[#A8A8A8]">
                          Period {a.schedule_slots?.period_number} ·{' '}
                          {a.schedule_slots?.start_time?.slice(0, 5)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              a.status === 'present'
                                ? 'bg-green-100 text-green-700'
                                : a.status === 'absent'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </>
    )
  }

  function renderReportsTab(classList, { teacherView = false } = {}) {
    const activeGroupId = teacherView ? teacherSelectedGroupId : selectedGroupId
    const activeGroups = teacherView ? teacherClassGroups : classGroups
    const activeDisplayClasses = teacherView ? teacherDisplayClasses : displayClasses
    const showGroupFeatures = activeGroupId && (teacherView || isAdmin)
    const summaryColors = groupSummary ? getAttendancePctColor(groupSummary.pct) : null

    return (
      <>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {(isAdmin || teacherView) && activeGroups.length > 0 && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Group</label>
              <select
                value={activeGroupId}
                onChange={(e) => {
                  if (teacherView) {
                    setTeacherSelectedGroupId(e.target.value)
                  } else {
                    setSelectedGroupId(e.target.value)
                  }
                  setSelectedClassId('')
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Groups</option>
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            >
              {showGroupFeatures ? (
                <option value="">All Classes</option>
              ) : (
                <option value="">Select class…</option>
              )}
              {(teacherView ? activeDisplayClasses : classList).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {!showGroupFeatures ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">From</label>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full md:w-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">To</label>
                <input
                  type="date"
                  value={reportToDate}
                  max={todayStr()}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full md:w-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={fetchReports}
                  disabled={!selectedClassId || reportLoading}
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow text-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  {reportLoading ? 'Loading…' : 'Generate Report'}
                </button>
              </div>
            </>
          ) : null}
        </div>

        {showGroupFeatures && groupSummary && (
          <div className={`rounded-xl border-2 p-5 mb-4 ${summaryColors.bg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-[#FFFFFF]">
                {groupSummary.name} Attendance Overview
                {teacherView && ' (your classes)'}
              </h3>
              <div className="flex gap-2">
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGroupDateRange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      groupDateRange === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-3xl font-bold ${summaryColors.text}`}>{groupSummary.pct}%</p>
            <p className="text-sm text-gray-600 dark:text-[#A8A8A8] mt-1">
              {groupSummary.present} / {groupSummary.total} present
            </p>
          </div>
        )}

        {showGroupFeatures && sectionStats.length > 0 && (
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 mb-6">
            {sectionStats.map((section) => {
              const colors = getAttendancePctColor(section.pct)
              return (
                <div
                  key={section.id}
                  className={`rounded-xl border-2 p-4 md:flex-1 md:min-w-[160px] ${colors.bg}`}
                >
                  <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-sm mb-1">{section.name}</p>
                  <p className={`text-2xl font-bold ${colors.text}`}>{section.pct}%</p>
                  <p className="text-xs text-gray-600 dark:text-[#A8A8A8] mt-1">
                    {section.presentTotal} / {section.total} present
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {reportLoading && showGroupFeatures && (
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mb-4">Loading group attendance…</p>
        )}

        {reportRows.length > 0 && (
          <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
            <table className="min-w-[500px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#262626]">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">Student</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">Present</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">Absent</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">Late</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-[#A8A8A8]">%</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => {
                  const rowColors = getAttendancePctColor(row.pct)
                  return (
                  <tr key={row.name + row.roll_number} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262626]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-[#FFFFFF]">{row.name}</p>
                      <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">Roll #{row.roll_number}</p>
                    </td>
                    <td className="text-center px-3 py-3 text-green-600">{row.present}</td>
                    <td className="text-center px-3 py-3 text-red-600">{row.absent}</td>
                    <td className="text-center px-3 py-3 text-yellow-600">{row.late}</td>
                    <td className="text-center px-3 py-3 text-gray-700 dark:text-[#A8A8A8]">{row.total}</td>
                    <td className={`text-center px-4 py-3 font-bold ${rowColors.text}`}>
                      {row.pct}%{row.pct < 50 && ' ⚠️'}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </>
    )
  }

  function renderMarkAttendance(showClassSelector = false) {
    const displayedSlots = isTeacher
      ? (selectedAttendanceClassId
          ? todaySlots.filter((s) => s.class_id === selectedAttendanceClassId)
          : [])
      : todaySlots

    const adminHasScope = selectedClassId || (selectedGroupId && groupClasses.length > 0)

    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
          {showClassSelector && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Group</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value)
                    setSelectedClassId('')
                    setActiveSlotId(null)
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="">All Groups</option>
                  {classGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setActiveSlotId(null)
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  {selectedGroupId ? (
                    <option value="">All Classes</option>
                  ) : (
                    <option value="">Select class…</option>
                  )}
                  {displayClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setActiveSlotId(null)
              }}
              className="w-full md:w-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>

        {isTeacher && !selectedAttendanceClassId && (
          <p className="text-sm text-gray-400 dark:text-[#A8A8A8] text-center py-8">
            Select a class to mark attendance.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Loading slots…</p>
        ) : showClassSelector && !adminHasScope ? (
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">
            Select a class, or choose a group with All Classes to view combined schedule.
          </p>
        ) : isTeacher && !selectedAttendanceClassId ? null : displayedSlots.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-[#A8A8A8]">No scheduled classes for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSlots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                isSaved={savedSlots.has(slot.id)}
                isActive={activeSlotId === slot.id}
                onToggle={() => handleSlotToggle(slot)}
                students={students}
                attendanceMap={attendanceMap}
                setAttendanceMap={setAttendanceMap}
                onSave={() => handleSaveAttendance(slot)}
                saving={saving}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Attendance</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {isTeacher && (
        <>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 border-b border-gray-200 dark:border-gray-700 mb-6">
            {TEACHER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTeacherTab(tab.id)}
                className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium relative ${
                  teacherTab === tab.id ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8]'
                }`}
              >
                {tab.label}
                {teacherTab === tab.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {teacherTab === 'mark' && (
            <>
              {userRole === 'teacher' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                    Select Class
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {teacherReportClasses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedAttendanceClassId(c.id)
                          setActiveSlotId(null)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          selectedAttendanceClassId === c.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {renderMarkAttendance(false)}
            </>
          )}
          {teacherTab === 'reports' && renderReportsTab(teacherReportClasses, { teacherView: true })}
          {teacherTab === 'student' && renderStudentReport(teacherReportClasses)}
        </>
      )}

      {isStudentView && (
        loading ? (
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Loading attendance…</p>
        ) : Object.keys(studentSummary).length === 0 ? (
          <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-[#A8A8A8]">No attendance records yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(studentSummary).map(([subject, { present, total }]) => {
              const pct = total > 0 ? Math.round((present / total) * 100) : 0
              const isExpanded = expandedStudentSubject === subject
              const records = studentRecordsBySubject[subject] ?? []

              return (
                <div
                  key={subject}
                  className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStudentSubject((prev) => (prev === subject ? null : subject))
                    }
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[#FFFFFF]">{subject}</p>
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                        {present}/{total} classes
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          pct >= 75 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {pct}%{pct < 75 && ' ⚠️'}
                      </span>
                      <span className="text-gray-400 dark:text-[#A8A8A8] text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t-2 border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-[#262626]">
                      {records.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No attendance records yet</p>
                      ) : (
                        <ul className="space-y-2">
                          {records.map((record, i) => (
                            <li
                              key={`${record.date}-${i}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700 dark:text-[#A8A8A8]">
                                {formatDateDDMMYYYY(record.date)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                  record.status === 'present'
                                    ? 'bg-green-100 text-green-700'
                                    : record.status === 'absent'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {record.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {isAdmin && (
        <>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 border-b border-gray-200 dark:border-gray-700 mb-6">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id)}
                className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium relative ${
                  adminTab === tab.id ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8]'
                }`}
              >
                {tab.label}
                {adminTab === tab.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {adminTab === 'mark' && renderMarkAttendance(true)}

          {adminTab === 'reports' && renderReportsTab(displayClasses)}

          {adminTab === 'student' && renderStudentReport(classes)}
        </>
      )}
    </div>
  )
}
