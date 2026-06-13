import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_SCHEDULE_SETTINGS = {
  start_time: '09:00',
  period_duration: 60,
  periods_per_day: 8,
  breaks: [],
}

function parseTime(timeStr) {
  const [hours, minutes] = (timeStr ?? '09:00').split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

function formatTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatDisplayTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  if (m) return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  return `${hour12} ${ampm}`
}

function formatPeriodLabel(start, end) {
  return `${formatDisplayTime(start)} – ${formatDisplayTime(end)}`
}

function PeriodTimeDisplay({ start, end }) {
  return (
    <>
      <span className="block text-xs text-gray-500 dark:text-gray-400">{formatDisplayTime(start)}</span>
      <span className="block text-xs text-gray-400 dark:text-gray-500">{formatDisplayTime(end)}</span>
    </>
  )
}

function normalizeSettings(row) {
  if (!row) return { ...DEFAULT_SCHEDULE_SETTINGS, breaks: [] }
  return {
    start_time: (row.start_time ?? '09:00').slice(0, 5),
    period_duration: row.period_duration ?? 60,
    periods_per_day: row.periods_per_day ?? 8,
    breaks: Array.isArray(row.breaks) ? [...row.breaks].sort((a, b) => a.after_period - b.after_period) : [],
  }
}

function calculatePeriodTimes(settings) {
  const { start_time, period_duration, periods_per_day, breaks } = settings
  const times = []
  let current = parseTime(start_time)

  for (let period = 1; period <= periods_per_day; period++) {
    const start = formatTime(current)
    current += period_duration
    const end = formatTime(current)
    times.push({ period, start, end, label: formatPeriodLabel(start, end) })

    const breakAfter = breaks.find((b) => b.after_period === period)
    if (breakAfter) {
      times.push({
        period: null,
        label: breakAfter.label,
        start: end,
        end: formatTime(current + breakAfter.duration),
        isBreak: true,
      })
      current += breakAfter.duration
    }
  }

  return times
}

export default function Schedule() {
  const { session } = useOutletContext()

  const [userRole, setUserRole] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [studentClassId, setStudentClassId] = useState(null)
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [scheduleSlots, setScheduleSlots] = useState([])
  const [scheduleSettings, setScheduleSettings] = useState(DEFAULT_SCHEDULE_SETTINGS)
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SCHEDULE_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showAddBreakForm, setShowAddBreakForm] = useState(false)
  const [breakAfterPeriod, setBreakAfterPeriod] = useState('')
  const [breakLabel, setBreakLabel] = useState('')
  const [breakDuration, setBreakDuration] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [editSubjectId, setEditSubjectId] = useState('')
  const [editTeacherId, setEditTeacherId] = useState('')
  const [editDays, setEditDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showMyPeriodsOnly, setShowMyPeriodsOnly] = useState(true)
  const [userId, setUserId] = useState(null)

  const isAdmin = userRole === 'admin'
  const isTeacher = userRole === 'teacher'
  const isStudent = userRole === 'student'
  const isParent = userRole === 'parent'
  const isStudentView = isStudent || isParent

  const periodTimes = useMemo(
    () => calculatePeriodTimes(scheduleSettings),
    [scheduleSettings]
  )

  useEffect(() => {
    if (!session?.user?.id) return
    setUserId(session.user.id)

    supabase
      .from('users')
      .select('role, institute_id, class_id, roll_number')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setUserRole(data.role)
          setInstituteId(data.institute_id)
          if (data.role === 'student') {
            setStudentClassId(data.class_id)
          } else if (data.role === 'parent') {
            const linkedStudent = await fetchLinkedStudent(data)
            setStudentClassId(linkedStudent?.class_id ?? null)
          }
        }
      })
  }, [session])

  useEffect(() => {
    if (!instituteId) return

    async function loadSettings() {
      const { data } = await supabase
        .from('schedule_settings')
        .select('start_time, period_duration, periods_per_day, breaks')
        .eq('institute_id', instituteId)
        .maybeSingle()

      setScheduleSettings(normalizeSettings(data))
    }

    loadSettings()
  }, [instituteId])

  useEffect(() => {
    if (!session?.user?.id || !userRole || !instituteId) return

    async function loadSetup() {
      setLoading(true)
      setError(null)

      try {
        if (userRole === 'admin') {
          const [classesRes, subjectsRes, teachersRes] = await Promise.all([
            supabase
              .from('classes')
              .select('id, name')
              .eq('institute_id', instituteId)
              .order('name'),
            supabase
              .from('subjects')
              .select('id, name, subject_classes(class_id)')
              .eq('institute_id', instituteId)
              .order('name'),
            supabase
              .from('users')
              .select('id, name, class_teachers(class_id, subject_id)')
              .eq('role', 'teacher')
              .eq('institute_id', instituteId)
              .order('name'),
          ])

          setClasses(classesRes.data ?? [])
          setSubjects(subjectsRes.data ?? [])
          setTeachers(teachersRes.data ?? [])
        } else if (userRole === 'teacher') {
          const { data: tcData } = await supabase
            .from('class_teachers')
            .select('class_id, classes(id, name)')
            .eq('teacher_id', session.user.id)

          const seen = new Set()
          const uniqueClasses = []
          for (const row of tcData ?? []) {
            if (!seen.has(row.class_id)) {
              seen.add(row.class_id)
              uniqueClasses.push(row.classes)
            }
          }
          setClasses(uniqueClasses.filter(Boolean))
          setSubjects([])
          setTeachers([])
        } else if ((userRole === 'student' || userRole === 'parent') && studentClassId) {
          const { data: cls } = await supabase
            .from('classes')
            .select('id, name')
            .eq('id', studentClassId)
            .single()

          setClasses(cls ? [cls] : [])
          setSelectedClassId(studentClassId)
        }
      } catch (err) {
        setError(err.message)
      }

      setLoading(false)
    }

    if ((userRole === 'student' || userRole === 'parent') && !studentClassId) {
      setLoading(false)
      return
    }

    loadSetup()
  }, [session, userRole, instituteId, studentClassId])

  const fetchSlots = useCallback(async () => {
    if (!selectedClassId) {
      setScheduleSlots([])
      return
    }

    const { data, error: fetchError } = await supabase
      .from('schedule_slots')
      .select('id, day_of_week, period_number, subject_id, teacher_id, subjects(name), users(name)')
      .eq('class_id', selectedClassId)

    if (fetchError) {
      setError(fetchError.message)
      setScheduleSlots([])
    } else {
      setScheduleSlots(data ?? [])
    }
  }, [selectedClassId])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  function getSlot(day, periodNumber) {
    return scheduleSlots.find(
      (s) => s.day_of_week === day && s.period_number === periodNumber
    )
  }

  function getPeriodRow(periodNumber) {
    return periodTimes.find((p) => p.period === periodNumber && !p.isBreak)
  }

  function openSettingsPanel() {
    setSettingsDraft({
      ...scheduleSettings,
      breaks: [...scheduleSettings.breaks],
    })
    setShowAddBreakForm(false)
    setBreakAfterPeriod('')
    setBreakLabel('')
    setBreakDuration('')
    setShowSettings(true)
  }

  function closeSettingsPanel() {
    setShowSettings(false)
    setShowAddBreakForm(false)
  }

  function handleAddBreak() {
    const afterPeriod = parseInt(breakAfterPeriod, 10)
    const duration = parseInt(breakDuration, 10)
    const label = breakLabel.trim()

    if (!afterPeriod || !label || !duration) {
      setError('Please fill in all break fields.')
      return
    }

    if (afterPeriod < 1 || afterPeriod >= settingsDraft.periods_per_day) {
      setError(`Break must be after period 1 to ${settingsDraft.periods_per_day - 1}.`)
      return
    }

    setSettingsDraft((prev) => ({
      ...prev,
      breaks: [
        ...prev.breaks.filter((b) => b.after_period !== afterPeriod),
        { after_period: afterPeriod, label, duration },
      ].sort((a, b) => a.after_period - b.after_period),
    }))
    setShowAddBreakForm(false)
    setBreakAfterPeriod('')
    setBreakLabel('')
    setBreakDuration('')
    setError(null)
  }

  function handleDeleteBreak(afterPeriod) {
    setSettingsDraft((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((b) => b.after_period !== afterPeriod),
    }))
  }

  async function syncInstituteSlotTimes(settings) {
    if (!instituteId) return

    const times = calculatePeriodTimes(settings)
    for (const row of times.filter((t) => !t.isBreak && t.period)) {
      const { error: updateError } = await supabase
        .from('schedule_slots')
        .update({ start_time: row.start, end_time: row.end })
        .eq('institute_id', instituteId)
        .eq('period_number', row.period)

      if (updateError) throw new Error(updateError.message)
    }
  }

  async function handleSaveSettings() {
    if (!instituteId) return

    setSavingSettings(true)
    setError(null)

    try {
      const payload = {
        institute_id: instituteId,
        start_time: settingsDraft.start_time,
        period_duration: Number(settingsDraft.period_duration),
        periods_per_day: Number(settingsDraft.periods_per_day),
        breaks: [...settingsDraft.breaks].sort((a, b) => a.after_period - b.after_period),
      }

      const { error: upsertError } = await supabase
        .from('schedule_settings')
        .upsert(payload, { onConflict: 'institute_id' })

      if (upsertError) throw new Error(upsertError.message)

      setScheduleSettings(normalizeSettings(payload))
      await syncInstituteSlotTimes(payload)
      await fetchSlots()
      closeSettingsPanel()
    } catch (err) {
      setError(err.message)
    }

    setSavingSettings(false)
  }

  function openEdit(day, periodNumber, slot) {
    setEditingSlot({
      day,
      period: periodNumber,
      slotId: slot?.id ?? null,
    })
    setEditSubjectId(slot?.subject_id ?? '')
    setEditTeacherId(slot?.teacher_id ?? '')
    setEditDays([day])
    setError(null)
  }

  function closeEdit() {
    setEditingSlot(null)
    setEditSubjectId('')
    setEditTeacherId('')
    setEditDays([])
  }

  async function handleSaveSlot(subjectId, teacherId) {
    if (!editingSlot || editDays.length === 0) return
    if (!subjectId || !teacherId) {
      setError('Please select both a subject and a teacher.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const period = getPeriodRow(editingSlot.period)

      for (const day of editDays) {
        const existing = getSlot(day, editingSlot.period)

        if (existing) {
          const { error: updateError } = await supabase
            .from('schedule_slots')
            .update({
              subject_id: subjectId,
              teacher_id: teacherId,
              start_time: period?.start,
              end_time: period?.end,
            })
            .eq('id', existing.id)
          if (updateError) throw new Error(updateError.message)
        } else {
          const { error: insertError } = await supabase.from('schedule_slots').insert({
            class_id: selectedClassId,
            day_of_week: day,
            period_number: editingSlot.period,
            start_time: period?.start,
            end_time: period?.end,
            subject_id: subjectId,
            teacher_id: teacherId,
            institute_id: instituteId,
          })
          if (insertError) throw new Error(insertError.message)
        }
      }

      await fetchSlots()
      closeEdit()
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  async function handleDeleteSlot(slotId) {
    setSaving(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('schedule_slots')
        .delete()
        .eq('id', slotId)
      if (deleteError) throw new Error(deleteError.message)

      await fetchSlots()
      closeEdit()
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name

  const editableSubjects = subjects.filter((s) =>
    s.subject_classes?.some((sc) => sc.class_id === selectedClassId)
  )

  const editableTeachers = editSubjectId
    ? teachers.filter((t) =>
        t.class_teachers?.some(
          (ct) => ct.class_id === selectedClassId && ct.subject_id === editSubjectId
        )
      )
    : []

  const editingPeriodRow = editingSlot ? getPeriodRow(editingSlot.period) : null

  return (
    <div className="overflow-hidden w-full">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">Schedule</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={openSettingsPanel}
            className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1C1C1C] rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors shrink-0"
          >
            ⚙️ Settings
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Loading schedule…</p>
      ) : isStudentView && !studentClassId ? (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No class assigned to your account.</p>
      ) : (
        <>
          {!isStudentView && classes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mb-6">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClassId(c.id)
                    closeEdit()
                  }}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedClassId === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-[#1C1C1C] border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-[#A8A8A8] hover:border-gray-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {isStudentView && selectedClassName && (
            <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mb-6">{selectedClassName}</p>
          )}

          {!isStudentView && !selectedClassId && (
            <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Select a class to view the timetable.</p>
          )}

          {selectedClassId && (
            <>
            {isTeacher && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowMyPeriodsOnly(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    showMyPeriodsOnly
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  My Periods Only
                </button>
                <button
                  type="button"
                  onClick={() => setShowMyPeriodsOnly(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !showMyPeriodsOnly
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  Full Class Schedule
                </button>
              </div>
            )}
            <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="overflow-x-auto w-full">
                <div className="min-w-[600px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="sticky left-0 bg-white dark:bg-[#1C1C1C] z-10 border-r border-gray-200 dark:border-gray-600 min-w-[80px] text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8] px-3 py-3 break-words">
                      Period
                    </th>
                    {DAY_LABELS.map((label) => (
                      <th
                        key={label}
                        className="min-w-[100px] text-center text-xs font-semibold text-gray-500 dark:text-[#A8A8A8] px-2 py-3 break-words"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodTimes.map((row, index) => (
                    <tr
                      key={row.isBreak ? `break-${index}` : `period-${row.period}`}
                      className={`border-b border-gray-200 dark:border-gray-700 ${
                        row.isBreak ? 'bg-gray-50 dark:bg-[#262626]' : ''
                      }`}
                    >
                      <td className={`sticky left-0 z-10 border-r border-gray-200 dark:border-gray-600 min-w-[80px] px-3 py-3 align-top break-words ${
                        row.isBreak ? 'bg-gray-50 dark:bg-[#262626]' : 'bg-white dark:bg-[#1C1C1C]'
                      }`}>
                        {row.start && row.end ? (
                          <PeriodTimeDisplay start={row.start} end={row.end} />
                        ) : null}
                      </td>
                      {row.isBreak ? (
                        <td
                          colSpan={DAYS.length}
                          className="text-center text-sm text-gray-500 dark:text-[#A8A8A8] py-3 break-words"
                        >
                          {row.label}
                        </td>
                      ) : (
                        DAYS.map((day) => {
                          const slot = getSlot(day, row.period)
                          const isMyPeriod = slot && slot.teacher_id === userId
                          const hideOtherTeacherSlot = isTeacher && showMyPeriodsOnly && slot && !isMyPeriod

                          return (
                            <td key={day} className="min-w-[100px] p-1.5 align-top break-words">
                              {hideOtherTeacherSlot || (isTeacher && showMyPeriodsOnly && !slot) ? (
                                <span className="text-xs text-gray-300 block min-h-12 px-2 py-2 break-words">
                                  —
                                </span>
                              ) : slot ? (
                                <div className="p-1.5 bg-blue-50 rounded-lg text-xs min-h-12 break-words">
                                  <p className="text-xs font-medium text-blue-800 break-words">
                                    {slot.subjects?.name}
                                  </p>
                                  <p className="text-xs text-blue-600 break-words">{slot.users?.name}</p>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(day, row.period, slot)}
                                      className="text-gray-400 dark:text-[#A8A8A8] hover:text-red-500 text-xs mt-1 break-words"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              ) : isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(day, row.period, null)}
                                  className="w-full min-h-12 text-gray-300 hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-500 dark:text-[#A8A8A8] text-xs rounded-lg border border-dashed border-gray-200 dark:border-gray-600 transition-colors break-words"
                                >
                                  + Add
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300 block min-h-12 px-2 py-2 break-words">
                                  —
                                </span>
                              )}
                            </td>
                          )
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </div>
            </div>
            </>
          )}

          {showSettings && (
            <div
              className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSettingsPanel()
              }}
            >
              <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-xl p-6 w-full max-w-lg mx-4 md:mx-0 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-[#FFFFFF]">Schedule Settings</h3>
                  <button
                    type="button"
                    onClick={closeSettingsPanel}
                    className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={settingsDraft.start_time}
                      onChange={(e) => setSettingsDraft((prev) => ({ ...prev, start_time: e.target.value }))}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                      Period Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={settingsDraft.period_duration}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setSettingsDraft((prev) => ({
                        ...prev,
                        period_duration: Number(e.target.value) || 60,
                      }))}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                      Periods per Day
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={12}
                      value={settingsDraft.periods_per_day}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const value = Math.min(12, Math.max(4, Number(e.target.value) || 8))
                        setSettingsDraft((prev) => ({
                          ...prev,
                          periods_per_day: value,
                          breaks: prev.breaks.filter((b) => b.after_period < value),
                        }))
                      }}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8]">
                        Breaks
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddBreakForm((prev) => !prev)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        {showAddBreakForm ? 'Cancel' : 'Add Break'}
                      </button>
                    </div>

                    {settingsDraft.breaks.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No breaks configured.</p>
                    ) : (
                      <ul className="space-y-2 mb-3">
                        {settingsDraft.breaks.map((brk) => (
                          <li
                            key={brk.after_period}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626] px-3 py-2 text-sm text-gray-700 dark:text-[#A8A8A8]"
                          >
                            <span>
                              After Period {brk.after_period} · {brk.label} · {brk.duration} mins
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteBreak(brk.after_period)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {showAddBreakForm && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626] p-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">After Period</label>
                            <input
                              type="number"
                              min={1}
                              max={settingsDraft.periods_per_day - 1}
                              value={breakAfterPeriod}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setBreakAfterPeriod(e.target.value)}
                              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1C1C1C] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Label</label>
                            <input
                              type="text"
                              value={breakLabel}
                              onChange={(e) => setBreakLabel(e.target.value)}
                              placeholder="e.g. Lunch Break, Short Break"
                              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1C1C1C] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Duration (minutes)</label>
                          <input
                            type="number"
                            min={1}
                            value={breakDuration}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setBreakDuration(e.target.value)}
                            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1C1C1C] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddBreak}
                          className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    {savingSettings ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingSlot && (
            <div
              className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeEdit()
              }}
            >
              <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-xl p-6 w-full max-w-sm mx-4 md:mx-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-[#FFFFFF]">
                    {DAY_LABELS[DAYS.indexOf(editingSlot.day)]} ·{' '}
                    {editingPeriodRow?.label ?? `Period ${editingSlot.period}`}
                  </h3>
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">
                    Apply to Days:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d, i) => (
                      <label
                        key={d}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                          editDays.includes(d)
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editDays.includes(d)}
                          onChange={() => setEditDays((prev) =>
                            prev.includes(d)
                              ? prev.filter((day) => day !== d)
                              : [...prev, d]
                          )}
                          className="hidden"
                        />
                        {DAY_LABELS[i]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                      Subject
                    </label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => {
                        setEditSubjectId(e.target.value)
                        setEditTeacherId('')
                      }}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">Select subject...</option>
                      {editableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                      Teacher
                    </label>
                    <select
                      value={editTeacherId}
                      onChange={(e) => setEditTeacherId(e.target.value)}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">Select teacher...</option>
                      {editableTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleSaveSlot(editSubjectId, editTeacherId)}
                      disabled={saving || !editSubjectId || !editTeacherId || editDays.length === 0}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    {editingSlot.slotId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(editingSlot.slotId)}
                        disabled={saving}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-40"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
