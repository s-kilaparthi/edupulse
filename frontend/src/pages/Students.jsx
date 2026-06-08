import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Students() {
  const { session } = useOutletContext()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState('teacher')
  const isAdmin = userRole === 'admin'
  const isTeacher = userRole === 'teacher'

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [studentName, setStudentName] = useState('')
  const [rollNumber, setRollNumber] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRoll, setEditRoll] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [selectedFilterClass, setSelectedFilterClass] = useState('')
  const [teacherClasses, setTeacherClasses] = useState([])
  const [adminSearch, setAdminSearch] = useState('')
  const [adminFilterClassId, setAdminFilterClassId] = useState('')
  const [allClasses, setAllClasses] = useState([])
  const [instituteId, setInstituteId] = useState(null)

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
  }, [session])

  useEffect(() => {
    if (userRole !== 'admin' || !instituteId) return
    supabase
      .from('classes')
      .select('id, name')
      .eq('institute_id', instituteId)
      .order('name')
      .then(({ data }) => {
        if (data) setAllClasses(data)
      })
  }, [userRole, instituteId])

  async function fetchStudents() {
    setError(null)

    if (userRole === 'teacher') {
      const { data: tcData } = await supabase
        .from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', session.user.id)

      const seen = new Set()
      const uniqueClasses = []
      for (const row of tcData ?? []) {
        if (row.classes && !seen.has(row.class_id)) {
          seen.add(row.class_id)
          uniqueClasses.push(row.classes)
        }
      }
      setTeacherClasses(uniqueClasses)
      const classIds = [...seen]

      if (classIds.length === 0) {
        setStudents([])
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, roll_number, class_id, classes(name)')
        .eq('role', 'student')
        .in('class_id', classIds)
        .order('roll_number')

      if (fetchError) {
        setError(fetchError.message)
        setStudents([])
      } else {
        setStudents(data ?? [])
      }
      setLoading(false)
      return
    }

    setTeacherClasses([])

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, roll_number, class_id, classes(name)')
      .eq('role', 'student')
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
      setStudents([])
    } else {
      setStudents(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!session?.user?.id || !userRole) return
    setLoading(true)
    fetchStudents()
  }, [userRole, session])

  async function handleCreateStudent(e) {
    e.preventDefault()
    const name = studentName.trim()
    const roll = rollNumber.trim()
    if (!name || !roll) {
      setError('Please fill in name and roll number.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      const instituteId = userData?.institute_id
      const autoEmail = `roll${roll}@${instituteId}.edupulse.com`
      const autoPassword = roll

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/create-student`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: autoEmail,
            password: autoPassword,
            name,
            roll_number: roll,
            institute_id: instituteId,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to create student')

      setStudentName('')
      setRollNumber('')
      setSuccessMessage(`Student ${name} added. Login: Roll ${roll}, Password: ${roll}`)
      await fetchStudents()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDeleteStudent(studentId) {
    if (!window.confirm('Delete this student?')) return
    const { error: deleteError } = await supabase.from('users').delete().eq('id', studentId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    if (editingId === studentId) setEditingId(null)
    setLoading(true)
    await fetchStudents()
  }

  function handleStartEdit(student) {
    setEditingId(student.id)
    setEditName(student.name ?? '')
    setEditRoll(String(student.roll_number ?? ''))
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditRoll('')
  }

  async function handleSaveEdit(studentId) {
    const name = editName.trim()
    const roll = editRoll.trim()
    if (!name || !roll) {
      setError('Name and roll number are required.')
      return
    }

    setEditSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('users')
      .update({ name, roll_number: roll })
      .eq('id', studentId)

    setEditSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingId(null)
    setLoading(true)
    await fetchStudents()
  }

  const displayedStudents = selectedFilterClass
    ? students.filter((s) => s.class_id === selectedFilterClass)
    : students

  const adminDisplayedStudents = isAdmin
    ? students.filter((s) => {
        const matchSearch =
          !adminSearch ||
          String(s.roll_number).includes(adminSearch) ||
          s.name?.toLowerCase().includes(adminSearch.toLowerCase())
        const matchClass = !adminFilterClassId || s.class_id === adminFilterClassId
        return matchSearch && matchClass
      })
    : displayedStudents

  const listStudents = isAdmin ? adminDisplayedStudents : displayedStudents

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Students</h1>

      {isAdmin && (
        <form
          onSubmit={handleCreateStudent}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Student</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="student-roll" className="block text-sm font-medium text-gray-700 mb-1">
                Roll number
              </label>
              <input
                id="student-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="101"
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
          </div>
        </form>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Search by roll number or name..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {allClasses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setAdminFilterClassId('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  adminFilterClassId === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Classes
              </button>
              {allClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAdminFilterClassId(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    adminFilterClassId === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
        {isTeacher && teacherClasses.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedFilterClass('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedFilterClass === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Classes
            </button>
            {teacherClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedFilterClass(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilterClass === c.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Total students:{' '}
          <span className="font-semibold text-gray-900">{listStudents.length}</span>
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading students…</p>
        ) : listStudents.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {isAdmin ? 'No students yet. Add one above.' : 'No students yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {listStudents.map((student) => (
              <li
                key={student.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
              >
                {editingId === student.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <input
                        type="text"
                        value={editRoll}
                        onChange={(e) => setEditRoll(e.target.value)}
                        placeholder="Roll number"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(student.id)}
                        disabled={editSaving}
                        className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40"
                      >
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-sm font-medium text-gray-500 px-4 py-2 rounded-lg hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/results', {
                            state: {
                              studentId: student.id,
                              studentName: student.name,
                              classId: student.class_id,
                              tab: 'student',
                            },
                          })
                        }
                        className="font-medium text-blue-600 hover:text-blue-800 text-left"
                      >
                        {student.name}
                      </button>
                      <p className="text-xs text-gray-400">
                        {student.classes?.name ?? 'No class assigned'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {student.email} · Roll {student.roll_number}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(student)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
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
