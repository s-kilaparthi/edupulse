import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isAdmin = userRole === 'admin'
  const isStudent = userRole === 'student'

  useEffect(() => {
    if (!session?.user?.id) return

    supabase
      .from('users')
      .select('role, institute_id, class_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role)
          setInstituteId(data.institute_id)
          if (data.role === 'student') {
            setStudentClassId(data.class_id)
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
        } else if (userRole === 'student' && studentClassId) {
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

    if (userRole === 'student' && !studentClassId) {
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
    setError(null)
  }

  function closeEdit() {
    setEditingSlot(null)
    setEditSubjectId('')
    setEditTeacherId('')
  }

  async function handleSaveSlot(day, periodNumber, subjectId, teacherId) {
    if (!subjectId || !teacherId) {
      setError('Please select both a subject and a teacher.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const existing = getSlot(day, periodNumber)
      const period = PERIODS.find((p) => p.number === periodNumber)

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
          period_number: periodNumber,
          start_time: period?.start,
          end_time: period?.end,
          subject_id: subjectId,
          teacher_id: teacherId,
          institute_id: instituteId,
        })
        if (insertError) throw new Error(insertError.message)
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
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schedule</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading schedule…</p>
      ) : isStudent && !studentClassId ? (
        <p className="text-sm text-gray-500">No class assigned to your account.</p>
      ) : (
        <>
          {!isStudent && classes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClassId(c.id)
                    closeEdit()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedClassId === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {isStudent && selectedClassName && (
            <p className="text-sm text-gray-500 mb-6">{selectedClassName}</p>
          )}

          {!isStudent && !selectedClassId && (
            <p className="text-sm text-gray-500">Select a class to view the timetable.</p>
          )}

          {selectedClassId && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3 w-28">
                      Period
                    </th>
                    {DAY_LABELS.map((label) => (
                      <th
                        key={label}
                        className="text-center text-xs font-semibold text-gray-500 px-2 py-3"
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
                      className={`border-b border-gray-100 ${
                        period.number === LUNCH_PERIOD ? 'bg-gray-50' : ''
                      }`}
                    >
                      <td className="text-xs font-medium text-gray-600 px-3 py-3 align-top whitespace-nowrap">
                        {period.label}
                      </td>
                      {period.number === LUNCH_PERIOD ? (
                        <td
                          colSpan={DAYS.length}
                          className="text-center text-sm text-gray-400 py-3"
                        >
                          🍽️ Lunch Break
                        </td>
                      ) : (
                        DAYS.map((day) => {
                          const slot = getSlot(day, period.number)

                          return (
                            <td key={day} className="px-2 py-2 align-top">
                              {slot ? (
                                <div className="p-2 bg-blue-50 rounded-lg text-xs min-h-12">
                                  <p className="font-medium text-blue-800">
                                    {slot.subjects?.name}
                                  </p>
                                  <p className="text-blue-600">{slot.users?.name}</p>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(day, period.number, slot)}
                                      className="text-gray-400 hover:text-red-500 text-xs mt-1"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              ) : isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(day, period.number, null)}
                                  className="w-full min-h-12 text-gray-300 hover:bg-gray-50 hover:text-gray-500 text-xs rounded-lg border border-dashed border-gray-200 transition-colors"
                                >
                                  + Add
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300 block min-h-12 px-2 py-2">
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
          )}

          {editingSlot && (
            <div
              className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeEdit()
              }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {DAY_LABELS[DAYS.indexOf(editingSlot.day)]} ·{' '}
                    {PERIODS.find((p) => p.number === editingSlot.period)?.label}
                  </h3>
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="text-gray-400 hover:text-gray-600 text-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Subject
                    </label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => {
                        setEditSubjectId(e.target.value)
                        setEditTeacherId('')
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Teacher
                    </label>
                    <select
                      value={editTeacherId}
                      onChange={(e) => setEditTeacherId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                      onClick={() =>
                        handleSaveSlot(
                          editingSlot.day,
                          editingSlot.period,
                          editSubjectId,
                          editTeacherId
                        )
                      }
                      disabled={saving || !editSubjectId || !editTeacherId}
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
    </>
  )
}
