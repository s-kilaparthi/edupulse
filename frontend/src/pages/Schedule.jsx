import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PERIODS = [
  { number: 1, start: '09:00', end: '10:00', label: '9-10 AM' },
  { number: 2, start: '10:00', end: '11:00', label: '10-11 AM' },
  { number: 3, start: '11:00', end: '12:00', label: '11-12 PM' },
  { number: 4, start: '12:00', end: '13:00', label: '12-1 PM LUNCH' },
  { number: 5, start: '13:00', end: '14:00', label: '1-2 PM' },
  { number: 6, start: '14:00', end: '15:00', label: '2-3 PM' },
  { number: 7, start: '15:00', end: '16:00', label: '3-4 PM' },
  { number: 8, start: '16:00', end: '17:00', label: '4-5 PM' },
]

const LUNCH_PERIOD = 4

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
      const period = PERIODS.find((p) => p.number === editingSlot.period)

      for (const day of editDays) {
        const existing = getSlot(day, editingSlot.period)

        if (existing) {
          const { error: updateError } = await supabase
            .from('schedule_slots')
            .update({ subject_id: subjectId, teacher_id: teacherId })
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

  return (
    <div className="overflow-hidden w-full">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Schedule</h1>

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
                  {PERIODS.map((period) => (
                    <tr
                      key={period.number}
                      className={`border-b border-gray-200 dark:border-gray-700 ${
                        period.number === LUNCH_PERIOD ? 'bg-gray-50 dark:bg-[#262626]' : ''
                      }`}
                    >
                      <td className={`sticky left-0 z-10 border-r border-gray-200 dark:border-gray-600 min-w-[80px] text-xs font-medium text-gray-600 dark:text-[#A8A8A8] px-3 py-3 align-top break-words ${
                        period.number === LUNCH_PERIOD ? 'bg-gray-50 dark:bg-[#262626]' : 'bg-white dark:bg-[#1C1C1C]'
                      }`}>
                        {period.label}
                      </td>
                      {period.number === LUNCH_PERIOD ? (
                        <td
                          colSpan={DAYS.length}
                          className="text-center text-sm text-gray-400 dark:text-[#A8A8A8] py-3 break-words"
                        >
                          🍽️ Lunch Break
                        </td>
                      ) : (
                        DAYS.map((day) => {
                          const slot = getSlot(day, period.number)
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
                                      onClick={() => openEdit(day, period.number, slot)}
                                      className="text-gray-400 dark:text-[#A8A8A8] hover:text-red-500 text-xs mt-1 break-words"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              ) : isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(day, period.number, null)}
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
                    {PERIODS.find((p) => p.number === editingSlot.period)?.label}
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
