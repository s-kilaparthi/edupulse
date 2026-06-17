import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import Loader from '../components/Loader'

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
  const [deletingTeacherId, setDeletingTeacherId] = useState(null)
  const [editingTeacherId, setEditingTeacherId] = useState(null)
  const [editTeacherName, setEditTeacherName] = useState('')
  const [editTeacherEmail, setEditTeacherEmail] = useState('')
  const [savingTeacher, setSavingTeacher] = useState(false)

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

  async function handleSaveTeacherEdit(teacherId) {
    setSavingTeacher(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        name: editTeacherName,
        email: editTeacherEmail,
      })
      .eq('id', teacherId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setEditingTeacherId(null)
      await fetchTeachers()
    }

    setSavingTeacher(false)
  }

  async function handleDeleteTeacher(teacherId, teacherName) {
    if (!window.confirm(`Delete teacher "${teacherName}"?`)) return
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/delete-user/${teacherId}`,
        { method: 'DELETE' }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed')
      await fetchTeachers()
    } catch (err) {
      alert('Error deleting teacher: ' + err.message)
    }
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
        <div className="flex justify-center items-center h-64">
          <Loader size={40} />
        </div>
      </div>
    )
  }

  if (userRole !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-[#A8A8A8]">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Teachers</h1>

      <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">Add Teacher</h2>
        <form onSubmit={handleCreateTeacher} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="teacher-name" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
              Full name
            </label>
            <input
              id="teacher-name"
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Priya Sharma"
              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
            />
          </div>

          <div>
            <label htmlFor="teacher-email" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
              Email
            </label>
            <input
              id="teacher-email"
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="priya@institute.com"
              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
              Password
            </label>
            <input
              id="teacher-password"
              type="password"
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              placeholder="e.g. teacher123"
              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">All Teachers</h2>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader size={40} />
          </div>
        ) : teachers.length === 0 ? (
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No teachers yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingTeacherId !== teacher.id && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 dark:text-[#FFFFFF]">{teacher.name}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTeacherId(teacher.id)
                              setEditTeacherName(teacher.name)
                              setEditTeacherEmail(teacher.email)
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                            disabled={deletingTeacherId === teacher.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mt-1">{teacher.email}</p>
                      </>
                    )}
                  </div>
                  {editingTeacherId !== teacher.id && (
                    <button
                      type="button"
                      onClick={() => toggleTeacher(teacher.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      {expandedTeacherId === teacher.id ? 'Hide Assignments' : 'Manage Assignments'}
                    </button>
                  )}
                </div>

                {editingTeacherId === teacher.id && (
                  <div className="mt-3 flex flex-col gap-2 border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                    <input
                      type="text"
                      value={editTeacherName}
                      onChange={(e) => setEditTeacherName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={editTeacherEmail}
                      onChange={(e) => setEditTeacherEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveTeacherEdit(teacher.id)}
                        disabled={savingTeacher}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
                      >
                        {savingTeacher ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTeacherId(null)}
                        className="text-gray-500 dark:text-[#A8A8A8] text-sm px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {expandedTeacherId === teacher.id && editingTeacherId !== teacher.id && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                    {loadingAssignments ? (
                      <div className="flex justify-center items-center h-32">
                        <Loader size={40} />
                      </div>
                    ) : (
                      <>
                        {assignments.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mb-4">No class assignments yet.</p>
                        ) : (
                          <div className="overflow-x-auto mb-4">
                            <table className="min-w-[400px] w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#262626]">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Class</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Subject</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assignments.map((row) => (
                                  <tr key={row.id} className="border-b border-gray-200 dark:border-gray-700">
                                    <td className="px-3 py-2 text-gray-900 dark:text-[#FFFFFF]">{row.classes?.name ?? '—'}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-[#A8A8A8]">{row.subjects?.name ?? '—'}</td>
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

                        <div className="flex flex-col md:flex-row gap-3 items-end">
                          <div className="w-full md:flex-1">
                            <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">Class</label>
                            <select
                              value={selectedClassId}
                              onChange={(e) => setSelectedClassId(e.target.value)}
                              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                            >
                              <option value="">Select class…</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full md:flex-1">
                            <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">Subject</label>
                            <select
                              value={selectedSubjectId}
                              onChange={(e) => setSelectedSubjectId(e.target.value)}
                              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
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
                            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 shadow-sm hover:shadow-md transition-shadow text-sm shrink-0"
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
