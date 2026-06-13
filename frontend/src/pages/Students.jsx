import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  filterClassesByGroup,
  fetchTeacherClassesAndGroups,
} from '../utils/teacherGroups'

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
  const [teacherClassGroups, setTeacherClassGroups] = useState([])
  const [teacherSelectedGroupId, setTeacherSelectedGroupId] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminFilterClassId, setAdminFilterClassId] = useState('')
  const [adminSelectedGroupId, setAdminSelectedGroupId] = useState('')
  const [allClasses, setAllClasses] = useState([])
  const [classGroups, setClassGroups] = useState([])
  const [instituteId, setInstituteId] = useState(null)

  const displayClasses = useMemo(
    () => filterClassesByGroup(allClasses, adminSelectedGroupId, classGroups),
    [allClasses, adminSelectedGroupId, classGroups]
  )

  const selectedGroup = useMemo(
    () => classGroups.find((g) => g.id === adminSelectedGroupId) ?? null,
    [classGroups, adminSelectedGroupId]
  )

  const groupClassIds = useMemo(
    () => new Set(displayClasses.map((c) => c.id)),
    [displayClasses]
  )

  const teacherDisplayClasses = useMemo(
    () => filterClassesByGroup(teacherClasses, teacherSelectedGroupId, teacherClassGroups),
    [teacherClasses, teacherSelectedGroupId, teacherClassGroups]
  )

  const teacherSelectedGroup = useMemo(
    () => teacherClassGroups.find((g) => g.id === teacherSelectedGroupId) ?? null,
    [teacherClassGroups, teacherSelectedGroupId]
  )

  const teacherGroupClassIds = useMemo(
    () => new Set(teacherDisplayClasses.map((c) => c.id)),
    [teacherDisplayClasses]
  )

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
    Promise.all([
      supabase
        .from('classes')
        .select('id, name')
        .eq('institute_id', instituteId)
        .order('name'),
      supabase
        .from('class_groups')
        .select('id, name, class_group_members(class_id, classes(id, name))')
        .eq('institute_id', instituteId)
        .order('name'),
    ]).then(([classesRes, groupsRes]) => {
      if (classesRes.data) setAllClasses(classesRes.data)
      if (groupsRes.data) setClassGroups(groupsRes.data)
    })
  }, [userRole, instituteId])

  useEffect(() => {
    if (!isAdmin || !adminSelectedGroupId) return
    if (adminFilterClassId && !groupClassIds.has(adminFilterClassId)) {
      setAdminFilterClassId('')
    }
  }, [isAdmin, adminSelectedGroupId, adminFilterClassId, groupClassIds])

  useEffect(() => {
    if (!isTeacher || !session?.user?.id || !instituteId) return
    fetchTeacherClassesAndGroups(session.user.id, instituteId).then(({ classes, groups }) => {
      setTeacherClasses(classes)
      setTeacherClassGroups(groups)
    })
  }, [isTeacher, session, instituteId])

  useEffect(() => {
    if (!isTeacher || !teacherSelectedGroupId) return
    if (selectedFilterClass && !teacherGroupClassIds.has(selectedFilterClass)) {
      setSelectedFilterClass('')
    }
  }, [isTeacher, teacherSelectedGroupId, selectedFilterClass, teacherGroupClassIds])

  async function fetchStudents() {
    setError(null)

    if (userRole === 'teacher') {
      const { classes: uniqueClasses } = await fetchTeacherClassesAndGroups(
        session.user.id,
        instituteId
      )
      setTeacherClasses(uniqueClasses)
      const classIds = uniqueClasses.map((c) => c.id)

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
        .filter((s) => {
          if (teacherSelectedGroupId && (!s.class_id || !teacherGroupClassIds.has(s.class_id))) {
            return false
          }
          return !selectedFilterClass || s.class_id === selectedFilterClass
        })
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
        if (adminSelectedGroupId && (!s.class_id || !groupClassIds.has(s.class_id))) {
          return false
        }
        const matchClass = !adminFilterClassId || s.class_id === adminFilterClassId
        return matchSearch && matchClass
      })
    : displayedStudents

  const listStudents = isAdmin ? adminDisplayedStudents : displayedStudents

  const showGroupSummary = isAdmin && adminSelectedGroupId && !adminFilterClassId && selectedGroup
  const showTeacherGroupSummary = isTeacher && teacherSelectedGroupId && !selectedFilterClass && teacherSelectedGroup

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Students</h1>

      {isAdmin && (
        <form
          onSubmit={handleCreateStudent}
          className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">Add Student</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Full name
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
              />
            </div>

            <div>
              <label htmlFor="student-roll" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Roll number
              </label>
              <input
                id="student-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="101"
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
              />
            </div>

            {isAdmin && allClasses.length > 0 && (
              <select
                value={newStudentClassId}
                onChange={(e) => setNewStudentClassId(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="">Assign to class (optional)</option>
                {allClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div>
              <label htmlFor="parent-name" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Parent Name
              </label>
              <input
                id="parent-name"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Parent/Guardian name"
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
              />
            </div>

            <div>
              <label htmlFor="parent-phone" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                Parent Phone
              </label>
              <input
                id="parent-phone"
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
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
          </div>
        </form>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Search by roll number or name..."
            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
          />

          {classGroups.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Group</label>
              <select
                value={adminSelectedGroupId}
                onChange={(e) => {
                  setAdminSelectedGroupId(e.target.value)
                  setAdminFilterClassId('')
                }}
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Groups</option>
                {classGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {displayClasses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setAdminFilterClassId('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  adminFilterClassId === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
                }`}
              >
                All Classes
              </button>
              {displayClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAdminFilterClassId(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    adminFilterClassId === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
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
          <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
            <input
              type="text"
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              placeholder="Search by roll number or name..."
              className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
            />

            {teacherClassGroups.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Group</label>
                <select
                  value={teacherSelectedGroupId}
                  onChange={(e) => {
                    setTeacherSelectedGroupId(e.target.value)
                    setSelectedFilterClass('')
                  }}
                  className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="">All Groups</option>
                  {teacherClassGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setSelectedFilterClass('')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilterClass === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
                }`}
              >
                All Classes
              </button>
              {teacherDisplayClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedFilterClass(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilterClass === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-[#A8A8A8] mb-4">
          {showGroupSummary ? (
            <span className="font-medium text-gray-800 dark:text-[#FFFFFF]">
              {selectedGroup.name} · {listStudents.length} Students · {displayClasses.length} Sections
            </span>
          ) : showTeacherGroupSummary ? (
            <span className="font-medium text-gray-800 dark:text-[#FFFFFF]">
              {teacherSelectedGroup.name} · {listStudents.length} Students · {teacherDisplayClasses.length} Sections (your classes)
            </span>
          ) : (
            <>
              Total students:{' '}
              <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">{listStudents.length}</span>
            </>
          )}
        </p>

        {loading ? (
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">Loading students…</p>
        ) : listStudents.length === 0 ? (
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">
            {isAdmin ? 'No students yet. Add one above.' : 'No students yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {listStudents.map((student) => (
              <li
                key={student.id}
                className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                {editingId === student.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editRoll}
                      onChange={(e) => setEditRoll(e.target.value)}
                      placeholder="Roll number"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      placeholder="Parent/Guardian name"
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
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
                        className="text-gray-500 dark:text-[#A8A8A8] text-xs px-3 py-1.5"
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
                      <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">
                        {student.classes?.name ?? 'No class assigned'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mt-1">
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
