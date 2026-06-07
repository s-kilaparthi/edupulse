import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Students() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('teacher')
  const isAdmin = userRole === 'admin'

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [rollNumber, setRollNumber] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRoll, setEditRoll] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setUserRole(data.role)
      })
  }, [session])

  async function fetchStudents() {
    setError(null)
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
    fetchStudents()
  }, [])

  async function handleAddStudent(e) {
    e.preventDefault()
    const name = fullName.trim()
    const studentEmail = email.trim()
    const roll = rollNumber.trim()

    if (!name || !studentEmail || !roll) {
      setError('Please fill in full name, email, and roll number.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('users').insert({
      id: crypto.randomUUID(),
      name,
      email: studentEmail,
      roll_number: roll,
      role: 'student',
      institute_id: null,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setFullName('')
    setEmail('')
    setRollNumber('')
    setLoading(true)
    await fetchStudents()
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

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Students</h1>

      {isAdmin && (
        <form
          onSubmit={handleAddStudent}
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="student-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="student-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <section>
        <p className="text-sm text-gray-600 mb-4">
          Total students:{' '}
          <span className="font-semibold text-gray-900">{students.length}</span>
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {isAdmin ? 'No students yet. Add one above.' : 'No students yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {students.map((student) => (
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
                      <p className="font-medium text-gray-900">{student.name}</p>
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
