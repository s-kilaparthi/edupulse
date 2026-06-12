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
  const [newStudentClassId, setNewStudentClassId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRoll, setEditRoll] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editParentName, setEditParentName] = useState('')
  const [editParentPhone, setEditParentPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [selectedFilterClass, setSelectedFilterClass] = useState('')
  const [teacherClasses, setTeacherClasses] = useState([])
  const [teacherSearch, setTeacherSearch] = useState('')
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
        .select('id, name, email, roll_number, class_id, parent_name, parent_phone, classes(name)')
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
      .select('id, name, email, roll_number, class_id, parent_name, parent_phone, classes(name)')
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
      const autoEmail = `roll${roll}@edupulse.com`
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
            class_id: newStudentClassId || null,
            parent_name: parentName.trim() || null,
            parent_phone: parentPhone.trim() || null,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to create student')

      setStudentName('')
      setRollNumber('')
      setNewStudentClassId('')
      setParentName('')
      setParentPhone('')
      setSuccessMessage(`Student ${name} added. Login: Roll ${roll}, Password: ${roll}`)
      await fetchStudents()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDeleteStudent(studentId) {
    if (!window.confirm('Delete this student?')) return
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/delete-user/${studentId}`,
        { method: 'DELETE' }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed')
      await fetchStudents()
    } catch (err) {
      alert('Error deleting student: ' + err.message)
    }
  }

  function handleStartEdit(student) {
    setEditingId(student.id)
    setEditName(student.name ?? '')
    setEditRoll(String(student.roll_number ?? ''))
    setEditEmail(student.email ?? '')
    setEditParentName(student.parent_name ?? '')
    setEditParentPhone(student.parent_phone ?? '')
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditRoll('')
    setEditEmail('')
    setEditParentName('')
    setEditParentPhone('')
  }

  async function handleSaveEdit(studentId) {
    const name = editName.trim()
    const roll = editRoll.trim()
    const email = editEmail.trim()
    if (!name || !roll) {
      setError('Name and roll number are required.')
      return
    }

    setEditSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        name,
        roll_number: roll,
        email,
        parent_name: editParentName.trim() || null,
        parent_phone: editParentPhone.trim() || null,
      })
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

  const displayedStudents = isTeacher
    ? students
        .filter((s) => !selectedFilterClass || s.class_id === selectedFilterClass)
        .filter(
          (s) =>
            !teacherSearch ||
            String(s.roll_number).includes(teacherSearch) ||
            s.name?.toLowerCase().includes(teacherSearch.toLowerCase())
        )
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Students</h1>

      {isAdmin && (
        <form
          onSubmit={handleCreateStudent}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Student</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full name
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700"
              />
            </div>

            <div>
              <label htmlFor="student-roll" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Roll number
              </label>
              <input
                id="student-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="101"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700"
              />
            </div>

            {isAdmin && allClasses.length > 0 && (
              <select
                value={newStudentClassId}
                onChange={(e) => setNewStudentClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
              >
                <option value="">Assign to class (optional)</option>
                {allClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div>
              <label htmlFor="parent-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Name
              </label>
              <input
                id="parent-name"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Parent/Guardian name"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700"
              />
            </div>

            <div>
              <label htmlFor="parent-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Phone
              </label>
              <input
                id="parent-phone"
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Search by roll number or name..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-gray-700"
          />

          {allClasses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setAdminFilterClassId('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  adminFilterClassId === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              type="button"
              onClick={() => setSelectedFilterClass('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedFilterClass === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {isTeacher && (
          <div className="mb-4">
            <input
              type="text"
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              placeholder="Search by roll number or name..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-gray-700"
            />
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Total students:{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{listStudents.length}</span>
        </p>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading students…</p>
        ) : listStudents.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isAdmin ? 'No students yet. Add one above.' : 'No students yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {listStudents.map((student) => (
              <li
                key={student.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                {editingId === student.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      value={editRoll}
                      onChange={(e) => setEditRoll(e.target.value)}
                      placeholder="Roll number"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      placeholder="Parent/Guardian name"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(student.id)}
                        disabled={editSaving}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      >
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-gray-500 dark:text-gray-400 text-xs px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
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
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {student.classes?.name ?? 'No class assigned'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        roll{student.roll_number}@edupulse.com · Roll {student.roll_number}
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
