import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Classes() {
  const { session } = useOutletContext()
  const [role, setRole] = useState(null)
  const [instituteId, setInstituteId] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)

  const [className, setClassName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [selectedSubjectIdsForClass, setSelectedSubjectIdsForClass] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [classes, setClasses] = useState([])
  const [studentCounts, setStudentCounts] = useState({})
  const [loading, setLoading] = useState(true)

  const [expandedClassId, setExpandedClassId] = useState(null)
  const [activeTab, setActiveTab] = useState('students')

  const [classStudents, setClassStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [classTeachers, setClassTeachers] = useState([])
  const [allTeachers, setAllTeachers] = useState([])
  const [allSubjects, setAllSubjects] = useState([])

  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [addTeacherId, setAddTeacherId] = useState('')
  const [addSubjectId, setAddSubjectId] = useState('')
  const [addClassSubjectId, setAddClassSubjectId] = useState('')
  const [addingTeacher, setAddingTeacher] = useState(false)
  const [addingClassSubject, setAddingClassSubject] = useState(false)
  const [editingClassId, setEditingClassId] = useState(null)
  const [editClassName, setEditClassName] = useState('')
  const [editAcademicYear, setEditAcademicYear] = useState('')
  const [savingClassName, setSavingClassName] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role, name, institute_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setRole(data.role)
          setInstituteId(data.institute_id)
        }
      })
      .finally(() => setLoadingRole(false))
  }, [session])

  const fetchClasses = useCallback(async () => {
    if (!instituteId) return
    setError(null)
    const { data: classRows, error: classError } = await supabase
      .from('classes')
      .select('id, name, academic_year, subject_classes(subject_id, subjects(name))')
      .eq('institute_id', instituteId)
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
  }, [instituteId])

  useEffect(() => {
    if (role !== 'admin' || !instituteId) return
    setLoading(true)
    fetchClasses()
  }, [role, instituteId, fetchClasses])

  useEffect(() => {
    if (role !== 'admin' || !instituteId) return

    async function loadOptions() {
      const [teachersRes, subjectsRes] = await Promise.all([
        supabase.from('users').select('id, name').eq('role', 'teacher').order('name'),
        supabase.from('subjects').select('id, name').eq('institute_id', instituteId).order('name'),
      ])
      if (teachersRes.data) setAllTeachers(teachersRes.data)
      if (subjectsRes.data) setAllSubjects(subjectsRes.data)
    }

    loadOptions()
  }, [role, instituteId])

  async function loadClassDetails(classId) {
    const [studentsRes, teachersRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, roll_number')
        .eq('class_id', classId)
        .eq('role', 'student')
        .order('roll_number'),
      supabase
        .from('class_teachers')
        .select('id, teacher_id, subject_id, users(name), subjects(name)')
        .eq('class_id', classId),
    ])

    setClassStudents(studentsRes.data ?? [])
    setClassTeachers(teachersRes.data ?? [])
    setSelectedStudentIds([])
    setStudentSearch('')
    setSearchResults([])
    setAddTeacherId('')
    setAddSubjectId('')
    setAddClassSubjectId('')
  }

  async function searchUnassignedStudents(query, classId) {
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearchingStudents(true)

    const { data } = await supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('role', 'student')
      .is('class_id', null)
      .or(`name.ilike.%${query}%,roll_number.ilike.%${query}%`)
      .order('roll_number')
      .limit(20)

    setSearchResults(data ?? [])
    setSearchingStudents(false)
  }

  async function handleCreateClass(e) {
    e.preventDefault()
    if (!className.trim() || !instituteId) return

    setSaving(true)
    setError(null)

    try {
      const { data: newClass, error: classErr } = await supabase
        .from('classes')
        .insert({
          name: className.trim(),
          academic_year: academicYear.trim(),
          institute_id: instituteId,
        })
        .select('id')
        .single()

      if (classErr) throw new Error(classErr.message)

      if (selectedSubjectIdsForClass.length > 0) {
        const rows = selectedSubjectIdsForClass.map((subjectId) => ({
          subject_id: subjectId,
          class_id: newClass.id,
        }))
        const { error: scError } = await supabase.from('subject_classes').insert(rows)
        if (scError) throw new Error(scError.message)
      }

      setClassName('')
      setAcademicYear('')
      setSelectedSubjectIdsForClass([])
      setLoading(true)
      await fetchClasses()
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  async function handleAddSubjectToClass(classId, subjectId) {
    const { error: insertError } = await supabase.from('subject_classes').insert({
      class_id: classId,
      subject_id: subjectId,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setAddClassSubjectId('')
    await fetchClasses()
  }

  async function handleRemoveSubjectFromClass(classId, subjectId) {
    const { error: deleteError } = await supabase
      .from('subject_classes')
      .delete()
      .eq('class_id', classId)
      .eq('subject_id', subjectId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

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

  async function handleAddMultipleStudents(classId) {
    if (selectedStudentIds.length === 0) return

    const { error } = await supabase
      .from('users')
      .update({ class_id: classId })
      .in('id', selectedStudentIds)

    if (!error) {
      setSelectedStudentIds([])
      setStudentSearch('')
      setSearchResults([])
      await loadClassDetails(classId)
      await fetchClasses()
    }
  }

  const isAdmin = role === 'admin'

  async function handleDeleteClass(classId, className) {
    if (!window.confirm(
      `Delete "${className}"? Students and teachers will be unassigned.`
    )) return

    try {
      await supabase.from('users')
        .update({ class_id: null })
        .eq('class_id', classId)

      await supabase.from('class_teachers')
        .delete().eq('class_id', classId)

      await supabase.from('subject_classes')
        .delete().eq('class_id', classId)

      await supabase.from('schedule_slots')
        .delete().eq('class_id', classId)

      await supabase.from('attendance')
        .delete().eq('class_id', classId)

      await supabase.from('exam_classes')
        .delete().eq('class_id', classId)

      const { error } = await supabase.from('classes')
        .delete().eq('id', classId)

      if (error) throw new Error(error.message)

      if (expandedClassId === classId) setExpandedClassId(null)
      if (editingClassId === classId) setEditingClassId(null)
      await fetchClasses()
    } catch (err) {
      alert('Error deleting class: ' + err.message)
    }
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
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025-26"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {allSubjects.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign Subjects
            </label>
            <div className="flex flex-wrap gap-2">
              {allSubjects.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    selectedSubjectIdsForClass.includes(s.id)
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjectIdsForClass.includes(s.id)}
                    onChange={() =>
                      setSelectedSubjectIdsForClass((prev) =>
                        prev.includes(s.id)
                          ? prev.filter((id) => id !== s.id)
                          : [...prev, s.id]
                      )
                    }
                    className="hidden"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingClassId !== cls.id && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{cls.name}</p>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClassId(cls.id)
                                  setEditClassName(cls.name)
                                  setEditAcademicYear(cls.academic_year ?? '')
                                }}
                                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(cls.id, cls.name)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {cls.academic_year || '—'} · {studentCounts[cls.id] ?? 0} students
                        </p>
                        {cls.subject_classes?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {cls.subject_classes.map((sc) => (
                              <span
                                key={sc.subject_id}
                                className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200"
                              >
                                {sc.subjects?.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {editingClassId !== cls.id && (
                    <button
                      type="button"
                      onClick={() => toggleClass(cls.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      {isExpanded ? 'Collapse' : 'Manage'}
                    </button>
                  )}
                </div>

                {editingClassId === cls.id && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                    <input
                      type="text"
                      value={editClassName}
                      onChange={(e) => setEditClassName(e.target.value)}
                      placeholder="Class name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={editAcademicYear}
                      onChange={(e) => setEditAcademicYear(e.target.value)}
                      placeholder="Academic year e.g. 2025-26"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setSavingClassName(true)
                          await supabase.from('classes')
                            .update({
                              name: editClassName,
                              academic_year: editAcademicYear,
                            })
                            .eq('id', cls.id)
                          setEditingClassId(null)
                          await fetchClasses()
                          setSavingClassName(false)
                        }}
                        disabled={savingClassName}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
                      >
                        {savingClassName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingClassId(null)}
                        className="text-gray-500 text-sm px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && editingClassId !== cls.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 border-b border-gray-200 mb-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('students')}
                        className={`shrink-0 px-4 py-2 text-sm font-medium relative ${
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
                        className={`shrink-0 px-4 py-2 text-sm font-medium relative ${
                          activeTab === 'teachers' ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        Teachers
                        {activeTab === 'teachers' && (
                          <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('subjects')}
                        className={`shrink-0 px-4 py-2 text-sm font-medium relative ${
                          activeTab === 'subjects' ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        Subjects
                        {activeTab === 'subjects' && (
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
                                  Unassign
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="text-xs font-medium text-gray-600 mb-2">
                            Add Students to Class
                          </p>

                          <input
                            type="text"
                            value={studentSearch}
                            onChange={(e) => {
                              setStudentSearch(e.target.value)
                              searchUnassignedStudents(e.target.value, cls.id)
                            }}
                            placeholder="Search by name or roll number..."
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2"
                          />

                          {searchingStudents && (
                            <p className="text-xs text-gray-400 mb-2">Searching...</p>
                          )}

                          {searchResults.length > 0 && (
                            <div className="max-h-48 overflow-y-auto space-y-1 mb-2 border border-gray-100 rounded-lg p-2">
                              {searchResults.map((s) => (
                                <label
                                  key={s.id}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                                    selectedStudentIds.includes(s.id)
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedStudentIds.includes(s.id)}
                                    onChange={() => setSelectedStudentIds((prev) =>
                                      prev.includes(s.id)
                                        ? prev.filter((id) => id !== s.id)
                                        : [...prev, s.id]
                                    )}
                                    className="rounded border-gray-300 text-blue-600"
                                  />
                                  <span className="font-medium flex-1">{s.name}</span>
                                  <span className="text-gray-400 text-xs shrink-0">
                                    Roll #{s.roll_number}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}

                          {studentSearch.length >= 2
                            && searchResults.length === 0
                            && !searchingStudents && (
                            <p className="text-xs text-gray-400 mb-2">
                              No unassigned students found.
                            </p>
                          )}

                          {selectedStudentIds.length > 0 && (
                            <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                              <span className="text-xs text-blue-700 font-medium">
                                {selectedStudentIds.length} student
                                {selectedStudentIds.length > 1 ? 's' : ''} selected
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddMultipleStudents(cls.id)}
                                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium"
                              >
                                Add to Class
                              </button>
                            </div>
                          )}
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
                                  Unassign
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

                    {activeTab === 'subjects' && (() => {
                      const assignedSubjectIds = cls.subject_classes?.map((sc) => sc.subject_id) ?? []
                      const unassignedSubjects = allSubjects.filter(
                        (s) => !assignedSubjectIds.includes(s.id)
                      )
                      return (
                        <div className="flex flex-col gap-4">
                          {cls.subject_classes?.length === 0 ? (
                            <p className="text-sm text-gray-500">No subjects assigned yet.</p>
                          ) : (
                            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                              {cls.subject_classes.map((sc) => (
                                <li
                                  key={sc.subject_id}
                                  className="flex items-center justify-between px-4 py-3"
                                >
                                  <p className="text-sm font-medium text-gray-900">
                                    {sc.subjects?.name ?? '—'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubjectFromClass(cls.id, sc.subject_id)}
                                    className="text-xs text-red-500 hover:text-red-700"
                                  >
                                    Unassign
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={addClassSubjectId}
                              onChange={(e) => setAddClassSubjectId(e.target.value)}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="">Add subject…</option>
                              {unassignedSubjects.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!addClassSubjectId) return
                                setAddingClassSubject(true)
                                await handleAddSubjectToClass(cls.id, addClassSubjectId)
                                setAddingClassSubject(false)
                              }}
                              disabled={!addClassSubjectId || addingClassSubject}
                              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
                            >
                              {addingClassSubject ? 'Adding…' : 'Add'}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
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
