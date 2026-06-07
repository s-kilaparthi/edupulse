import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

const INSTITUTE_ID = '8535a900-49f5-405a-9d25-05c20dcba910'

export default function Classes() {
  const { session } = useOutletContext()
  const [role, setRole] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)

  const [className, setClassName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [classes, setClasses] = useState([])
  const [studentCounts, setStudentCounts] = useState({})
  const [loading, setLoading] = useState(true)

  const [expandedClassId, setExpandedClassId] = useState(null)
  const [activeTab, setActiveTab] = useState('students')

  const [classStudents, setClassStudents] = useState([])
  const [unassignedStudents, setUnassignedStudents] = useState([])
  const [classTeachers, setClassTeachers] = useState([])
  const [allTeachers, setAllTeachers] = useState([])
  const [allSubjects, setAllSubjects] = useState([])

  const [addStudentId, setAddStudentId] = useState('')
  const [addTeacherId, setAddTeacherId] = useState('')
  const [addSubjectId, setAddSubjectId] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [addingTeacher, setAddingTeacher] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.role) setRole(data.role)
      })
      .finally(() => setLoadingRole(false))
  }, [session])

  const fetchClasses = useCallback(async () => {
    setError(null)
    const { data: classRows, error: classError } = await supabase
      .from('classes')
      .select('id, name, academic_year')
      .eq('institute_id', INSTITUTE_ID)
      .order('name')

    if (classError) {
      setError(classError.message)
      setClasses([])
      setLoading(false)
      return
    }

    setClasses(classRows ?? [])

    const { data: students } = await supabase
      .from('users')
      .select('class_id')
      .eq('role', 'student')
      .not('class_id', 'is', null)

    const counts = {}
    for (const row of students ?? []) {
      counts[row.class_id] = (counts[row.class_id] ?? 0) + 1
    }
    setStudentCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    setLoading(true)
    fetchClasses()
  }, [role, fetchClasses])

  useEffect(() => {
    if (role !== 'admin') return

    async function loadOptions() {
      const [teachersRes, subjectsRes] = await Promise.all([
        supabase.from('users').select('id, name').eq('role', 'teacher').order('name'),
        supabase.from('subjects').select('id, name').eq('institute_id', INSTITUTE_ID).order('name'),
      ])
      if (teachersRes.data) setAllTeachers(teachersRes.data)
      if (subjectsRes.data) setAllSubjects(subjectsRes.data)
    }

    loadOptions()
  }, [role])

  async function loadClassDetails(classId) {
    const [studentsRes, unassignedRes, teachersRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, roll_number')
        .eq('class_id', classId)
        .eq('role', 'student')
        .order('roll_number'),
      supabase
        .from('users')
        .select('id, name, roll_number')
        .eq('role', 'student')
        .is('class_id', null)
        .order('roll_number'),
      supabase
        .from('class_teachers')
        .select('id, teacher_id, subject_id, users(name), subjects(name)')
        .eq('class_id', classId),
    ])

    setClassStudents(studentsRes.data ?? [])
    setUnassignedStudents(unassignedRes.data ?? [])
    setClassTeachers(teachersRes.data ?? [])
    setAddStudentId('')
    setAddTeacherId('')
    setAddSubjectId('')
  }

  async function handleCreateClass(e) {
    e.preventDefault()
    if (!className.trim()) return

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('classes').insert({
      name: className.trim(),
      academic_year: academicYear.trim(),
      institute_id: INSTITUTE_ID,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setClassName('')
    setAcademicYear('')
    setLoading(true)
    await fetchClasses()
  }

  async function toggleClass(classId) {
    if (expandedClassId === classId) {
      setExpandedClassId(null)
      return
    }
    setExpandedClassId(classId)
    setActiveTab('students')
    await loadClassDetails(classId)
  }

  async function handleRemoveStudent(studentId) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ class_id: null })
      .eq('id', studentId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (expandedClassId) await loadClassDetails(expandedClassId)
    await fetchClasses()
  }

  async function handleAddStudent(classId) {
    if (!addStudentId) return
    setAddingStudent(true)

    const { error: updateError } = await supabase
      .from('users')
      .update({ class_id: classId })
      .eq('id', addStudentId)

    setAddingStudent(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadClassDetails(classId)
    await fetchClasses()
  }

  async function handleRemoveTeacher(classTeacherId) {
    const { error: deleteError } = await supabase
      .from('class_teachers')
      .delete()
      .eq('id', classTeacherId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (expandedClassId) await loadClassDetails(expandedClassId)
  }

  async function handleAddTeacher(classId) {
    if (!addTeacherId || !addSubjectId) return
    setAddingTeacher(true)

    const { error: insertError } = await supabase.from('class_teachers').insert({
      class_id: classId,
      teacher_id: addTeacherId,
      subject_id: addSubjectId,
    })

    setAddingTeacher(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    await loadClassDetails(classId)
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
        <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
      </div>

      <form
        onSubmit={handleCreateClass}
        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-gray-900">Create Class</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class 11A or JEE Batch 2026"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025-26"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="self-start bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-sm text-gray-500">No classes yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {classes.map((cls) => {
            const isExpanded = expandedClassId === cls.id
            return (
              <li
                key={cls.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{cls.name}</p>
                    <p className="text-sm text-gray-500">
                      {cls.academic_year || '—'} · {studentCounts[cls.id] ?? 0} students
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleClass(cls.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  >
                    {isExpanded ? 'Collapse' : 'Manage'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex gap-1 border-b border-gray-200 mb-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('students')}
                        className={`px-4 py-2 text-sm font-medium relative ${
                          activeTab === 'students' ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        Students
                        {activeTab === 'students' && (
                          <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('teachers')}
                        className={`px-4 py-2 text-sm font-medium relative ${
                          activeTab === 'teachers' ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        Teachers
                        {activeTab === 'teachers' && (
                          <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                        )}
                      </button>
                    </div>

                    {activeTab === 'students' && (
                      <div className="flex flex-col gap-4">
                        {classStudents.length === 0 ? (
                          <p className="text-sm text-gray-500">No students in this class.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {classStudents.map((student) => (
                              <li
                                key={student.id}
                                className="flex items-center justify-between px-4 py-3"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{student.name}</p>
                                  <p className="text-xs text-gray-500">Roll #{student.roll_number}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudent(student.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={addStudentId}
                            onChange={(e) => setAddStudentId(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="">Add student…</option>
                            {unassignedStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.roll_number} — {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddStudent(cls.id)}
                            disabled={!addStudentId || addingStudent}
                            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
                          >
                            {addingStudent ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'teachers' && (
                      <div className="flex flex-col gap-4">
                        {classTeachers.length === 0 ? (
                          <p className="text-sm text-gray-500">No teachers assigned yet.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {classTeachers.map((ct) => (
                              <li
                                key={ct.id}
                                className="flex items-center justify-between px-4 py-3"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {ct.users?.name ?? '—'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {ct.subjects?.name ?? '—'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeacher(ct.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={addTeacherId}
                            onChange={(e) => setAddTeacherId(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="">Select teacher…</option>
                            {allTeachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <select
                            value={addSubjectId}
                            onChange={(e) => setAddSubjectId(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="">Select subject…</option>
                            {allSubjects.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddTeacher(cls.id)}
                            disabled={!addTeacherId || !addSubjectId || addingTeacher}
                            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
                          >
                            {addingTeacher ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
