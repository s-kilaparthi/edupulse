import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Teachers() {
  const { session } = useOutletContext()

  const [userRole, setUserRole] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [expandedTeacherId, setExpandedTeacherId] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingAssignment, setAddingAssignment] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [teacherName, setTeacherName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [loading, setLoading] = useState(true)

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
        }
      })
      .finally(() => setLoadingRole(false))
  }, [session])

  async function fetchTeachers() {
    if (!instituteId) return
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'teacher')
      .eq('institute_id', instituteId)
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
      setTeachers([])
    } else {
      setTeachers(data ?? [])
    }
    setLoading(false)
  }

  async function fetchOptions() {
    if (!instituteId) return

    const [classesRes, subjectsRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name')
        .eq('institute_id', instituteId)
        .order('name'),
      supabase
        .from('subjects')
        .select('id, name')
        .eq('institute_id', instituteId)
        .order('name'),
    ])

    setClasses(classesRes.data ?? [])
    setSubjects(subjectsRes.data ?? [])
  }

  useEffect(() => {
    if (userRole !== 'admin' || !instituteId) return
    setLoading(true)
    fetchTeachers()
    fetchOptions()
  }, [userRole, instituteId])

  async function fetchAssignments(teacherId) {
    setLoadingAssignments(true)
    const { data, error: fetchError } = await supabase
      .from('class_teachers')
      .select('id, class_id, subject_id, classes(name), subjects(name)')
      .eq('teacher_id', teacherId)

    if (fetchError) {
      setError(fetchError.message)
      setAssignments([])
    } else {
      setAssignments(data ?? [])
    }
    setLoadingAssignments(false)
  }

  async function toggleTeacher(teacherId) {
    if (expandedTeacherId === teacherId) {
      setExpandedTeacherId(null)
      setAssignments([])
      setSelectedClassId('')
      setSelectedSubjectId('')
      return
    }

    setExpandedTeacherId(teacherId)
    setSelectedClassId('')
    setSelectedSubjectId('')
    setError(null)
    await fetchAssignments(teacherId)
  }

  async function handleCreateTeacher(e) {
    e.preventDefault()
    const name = teacherName.trim()
    const email = teacherEmail.trim()
    const password = teacherPassword.trim()

    if (!name || !email || !password) {
      setError('Please fill in name, email, and password.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/create-teacher`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            institute_id: instituteId,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to create teacher')

      setTeacherName('')
      setTeacherEmail('')
      setTeacherPassword('')
      setSuccessMessage(`Teacher ${name} added. Login: ${email}, Password: ${password}`)
      setLoading(true)
      await fetchTeachers()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleAddAssignment() {
    if (!expandedTeacherId || !selectedClassId || !selectedSubjectId) return

    setAddingAssignment(true)
    setError(null)

    const { error: insertError } = await supabase.from('class_teachers').insert({
      teacher_id: expandedTeacherId,
      class_id: selectedClassId,
      subject_id: selectedSubjectId,
    })

    setAddingAssignment(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSelectedClassId('')
    setSelectedSubjectId('')
    await fetchAssignments(expandedTeacherId)
  }

  async function handleRemoveAssignment(assignmentId) {
    const { error: deleteError } = await supabase
      .from('class_teachers')
      .delete()
      .eq('id', assignmentId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (expandedTeacherId) await fetchAssignments(expandedTeacherId)
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (userRole !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teachers</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Teacher</h2>
        <form onSubmit={handleCreateTeacher} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="teacher-name" className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              id="teacher-name"
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Priya Sharma"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="teacher-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="teacher-email"
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="priya@institute.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="teacher-password"
              type="password"
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              placeholder="e.g. teacher123"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">All Teachers</h2>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading teachers…</p>
        ) : teachers.length === 0 ? (
          <p className="text-gray-500 text-sm">No teachers yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{teacher.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{teacher.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTeacher(teacher.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  >
                    {expandedTeacherId === teacher.id ? 'Hide Assignments' : 'Manage Assignments'}
                  </button>
                </div>

                {expandedTeacherId === teacher.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {loadingAssignments ? (
                      <p className="text-sm text-gray-500">Loading assignments…</p>
                    ) : (
                      <>
                        {assignments.length === 0 ? (
                          <p className="text-sm text-gray-500 mb-4">No class assignments yet.</p>
                        ) : (
                          <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Class</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Subject</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assignments.map((row) => (
                                  <tr key={row.id} className="border-b border-gray-100">
                                    <td className="px-3 py-2 text-gray-900">{row.classes?.name ?? '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{row.subjects?.name ?? '—'}</td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAssignment(row.id)}
                                        className="text-xs text-red-500 hover:text-red-700"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                            <select
                              value={selectedClassId}
                              onChange={(e) => setSelectedClassId(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="">Select class…</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                            <select
                              value={selectedSubjectId}
                              onChange={(e) => setSelectedSubjectId(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="">Select subject…</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddAssignment}
                            disabled={addingAssignment || !selectedClassId || !selectedSubjectId}
                            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 text-sm shrink-0"
                          >
                            {addingAssignment ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
