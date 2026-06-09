import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

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

function StudentList({
  students,
  attendanceMap,
  setAttendanceMap,
  onSave,
  saving,
}) {
  return (
    <div className="border-t border-gray-100 p-4">
      <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{student.name}</p>
              <p className="text-xs text-gray-400">Roll #{student.roll_number}</p>
            </div>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setAttendanceMap((prev) => ({ ...prev, [student.id]: status }))
                  }
                  className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    attendanceMap[student.id] === status
                      ? STATUS_COLORS[status]
                      : 'bg-gray-50 text-gray-400 border-gray-200'
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
        <p className="text-xs text-gray-500">
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold text-gray-900">
            {slot.subjects?.name} — {slot.classes?.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Period {slot.period_number} · {slot.start_time?.slice(0, 5)} -{' '}
            {slot.end_time?.slice(0, 5)}
          </p>
        </div>
        {isSaved ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium hover:bg-green-200"
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
        <div className="border-t border-gray-100 p-4">
          <p className="text-sm text-gray-500">No students in this class.</p>
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
  const [selectedClassId, setSelectedClassId] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [studentSummary, setStudentSummary] = useState({})
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
  const [teacherTab, setTeacherTab] = useState('mark')

  const isTeacher = userRole === 'teacher'
  const isStudent = userRole === 'student'
  const isAdmin = userRole === 'admin'

  useEffect(() => {
    if (!session?.user?.id) return

    supabase
      .from('users')
      .select('role, institute_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role)
          setInstituteId(data.institute_id)
          setUserId(session.user.id)
        }
      })
  }, [session])

  useEffect(() => {
    if (!instituteId || !isAdmin) return

    supabase
      .from('classes')
      .select('id, name')
      .eq('institute_id', instituteId)
      .order('name')
      .then(({ data }) => setClasses(data ?? []))
  }, [instituteId, isAdmin])

  useEffect(() => {
    if (!userId || !isTeacher) return

    supabase
      .from('class_teachers')
      .select('class_id, classes(id, name)')
      .eq('teacher_id', userId)
      .then(({ data }) => {
        const unique = []
        const seen = new Set()
        for (const row of data ?? []) {
          if (!seen.has(row.class_id)) {
            seen.add(row.class_id)
            unique.push(row.classes)
          }
        }
        setTeacherReportClasses(unique.filter(Boolean))
      })
  }, [userId, isTeacher])

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
    if (!selectedClassId || !instituteId || !selectedDate) {
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
      .eq('class_id', selectedClassId)
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
  }, [selectedClassId, instituteId, selectedDate, fetchSavedSlots])

  useEffect(() => {
    if (!userId || !instituteId) return
    if (isTeacher) fetchTeacherSlots()
  }, [isTeacher, userId, instituteId, selectedDate, fetchTeacherSlots])

  useEffect(() => {
    if (!instituteId || !isAdmin || adminTab !== 'mark') return
    if (selectedClassId) fetchAdminSlots()
    else setTodaySlots([])
  }, [isAdmin, adminTab, selectedClassId, instituteId, selectedDate, fetchAdminSlots])

  useEffect(() => {
    if (!userId || !instituteId || !isStudent) return

    setLoading(true)

    supabase
      .from('attendance')
      .select('status, date, subject_id, subjects(name)')
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        const subjectMap = {}
        for (const row of data ?? []) {
          const sname = row.subjects?.name ?? 'Unknown'
          if (!subjectMap[sname]) subjectMap[sname] = { present: 0, total: 0 }
          subjectMap[sname].total += 1
          if (row.status === 'present' || row.status === 'late') {
            subjectMap[sname].present += 1
          }
        }
        setStudentSummary(subjectMap)
        setLoading(false)
      })
  }, [userId, instituteId, isStudent])

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
    }

    setSaving(false)
  }

  async function fetchReports() {
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

    const classStudents = studentsRes.data ?? []
    const records = attendanceRes.data ?? []

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

    setReportRows(
      Object.values(agg).map((row) => {
        const counted = row.present + row.late
        const pct = row.total > 0 ? Math.round((counted / row.total) * 100) : 0
        return { ...row, pct }
      })
    )

    setReportLoading(false)
  }

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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
              <span className="text-green-600 font-semibold">✅ Present: {present}</span>
              <span className="text-red-600 font-semibold">❌ Absent: {absent}</span>
              <span className="text-yellow-600 font-semibold">🕐 Late: {late}</span>
              <span className="font-bold text-gray-900">
                Overall: {pct}%{pct < 75 && ' ⚠️'}
              </span>
            </div>

            {studentAttendance.length === 0 ? (
              <p className="text-sm text-gray-500">No attendance records for this student.</p>
            ) : (
              <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Subject</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Period</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAttendance.map((a, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2">{a.date}</td>
                        <td className="px-3 py-2">{a.subjects?.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
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

  function renderReportsTab(classList) {
    return (
      <>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select class…</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={reportFromDate}
              onChange={(e) => setReportFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={reportToDate}
              max={todayStr()}
              onChange={(e) => setReportToDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchReports}
              disabled={!selectedClassId || reportLoading}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
            >
              {reportLoading ? 'Loading…' : 'Generate Report'}
            </button>
          </div>
        </div>

        {reportRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Present</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Absent</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Late</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.name + row.roll_number} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-400">Roll #{row.roll_number}</p>
                    </td>
                    <td className="text-center px-3 py-3 text-green-600">{row.present}</td>
                    <td className="text-center px-3 py-3 text-red-600">{row.absent}</td>
                    <td className="text-center px-3 py-3 text-yellow-600">{row.late}</td>
                    <td className="text-center px-3 py-3 text-gray-700">{row.total}</td>
                    <td
                      className={`text-center px-4 py-3 font-bold ${
                        row.pct >= 75 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.pct}%{row.pct < 75 && ' ⚠️'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  function renderMarkAttendance(showClassSelector = false) {
    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {showClassSelector && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  setActiveSlotId(null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setActiveSlotId(null)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading slots…</p>
        ) : showClassSelector && !selectedClassId ? (
          <p className="text-sm text-gray-500">Select a class to view schedule slots.</p>
        ) : todaySlots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No scheduled classes for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySlots.map((slot) => (
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attendance</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {isTeacher && (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {TEACHER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTeacherTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium relative ${
                  teacherTab === tab.id ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {tab.label}
                {teacherTab === tab.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {teacherTab === 'mark' && renderMarkAttendance(false)}
          {teacherTab === 'reports' && renderReportsTab(teacherReportClasses)}
          {teacherTab === 'student' && renderStudentReport(teacherReportClasses)}
        </>
      )}

      {isStudent && (
        loading ? (
          <p className="text-sm text-gray-500">Loading attendance…</p>
        ) : Object.keys(studentSummary).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No attendance records yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(studentSummary).map(([subject, { present, total }]) => {
              const pct = total > 0 ? Math.round((present / total) * 100) : 0
              return (
                <div
                  key={subject}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200"
                >
                  <div>
                    <p className="font-medium text-gray-900">{subject}</p>
                    <p className="text-xs text-gray-500">
                      {present}/{total} classes
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      pct >= 75 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {pct}%{pct < 75 && ' ⚠️'}
                  </span>
                </div>
              )
            })}
          </div>
        )
      )}

      {isAdmin && (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium relative ${
                  adminTab === tab.id ? 'text-gray-900' : 'text-gray-500'
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

          {adminTab === 'reports' && renderReportsTab(classes)}

          {adminTab === 'student' && renderStudentReport(classes)}
        </>
      )}
    </div>
  )
}
