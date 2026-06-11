import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'

export default function Subjects() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('teacher')
  const [instituteId, setInstituteId] = useState(null)
  const [studentClassId, setStudentClassId] = useState(null)

  const [subjects, setSubjects] = useState([])
  const [subjectName, setSubjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showAddTopic, setShowAddTopic] = useState(null)
  const [topicInput, setTopicInput] = useState('')
  const [topicSaving, setTopicSaving] = useState(false)
  const [extractingId, setExtractingId] = useState(null)
  const [extractedSubjectId, setExtractedSubjectId] = useState(null)
  const [suggestedTopics, setSuggestedTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [extractError, setExtractError] = useState(null)
  const [savingTopics, setSavingTopics] = useState(false)
  const pdfRef = useRef(null)

  const [selectedClassId, setSelectedClassId] = useState('')
  const [availableClasses, setAvailableClasses] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [classesLoaded, setClassesLoaded] = useState(false)
  const [selectedClassIdsForSubject, setSelectedClassIdsForSubject] = useState([])
  const [manageClassesSubjectId, setManageClassesSubjectId] = useState(null)
  const [manageClassIds, setManageClassIds] = useState([])
  const [savingClassAssignments, setSavingClassAssignments] = useState(false)
  const [subjectTeacherMap, setSubjectTeacherMap] = useState({})
  const [subjectNotes, setSubjectNotes] = useState({})
  const [addingNoteFor, setAddingNoteFor] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteUrl, setNoteUrl] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
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

  const isAdmin = userRole === 'admin'
  const isTeacher = userRole === 'teacher'
  const isStudent = userRole === 'student'
  const isParent = userRole === 'parent'
  const isStudentView = isStudent || isParent

  useEffect(() => {
    if (!session?.user?.id || !userRole) return

    async function loadClasses() {
      setClassesLoaded(false)

      if (userRole === 'teacher') {
        const { data: tc } = await supabase
          .from('class_teachers')
          .select('class_id, classes(id, name), subject_id')
          .eq('teacher_id', session.user.id)

        const seen = new Set()
        const uniqueClasses = []
        for (const row of tc ?? []) {
          if (!seen.has(row.class_id)) {
            seen.add(row.class_id)
            uniqueClasses.push(row.classes)
          }
        }
        setAvailableClasses(uniqueClasses.filter(Boolean))
        setTeacherAssignments(tc ?? [])
        setClassesLoaded(true)
      } else if (userRole === 'admin' && instituteId) {
        const { data: cls } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', instituteId)
          .order('name')

        setAvailableClasses(cls ?? [])
        setTeacherAssignments([])
        setClassesLoaded(true)
      }
    }

    loadClasses()
  }, [userRole, instituteId, session])

  async function fetchSubjectNotes(subjectIds, classId) {
    if (!subjectIds.length) {
      setSubjectNotes({})
      return
    }

    let query = supabase
      .from('subject_notes')
      .select('id, subject_id, title, url, created_at')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })

    if (classId) query = query.eq('class_id', classId)

    const { data } = await query

    const map = {}
    for (const note of data ?? []) {
      if (!map[note.subject_id]) map[note.subject_id] = []
      map[note.subject_id].push(note)
    }
    setSubjectNotes(map)
  }

  async function fetchSubjects() {
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    if (userRole === 'teacher') {
      const subjectIds = [
        ...new Set(teacherAssignments.map((a) => a.subject_id).filter(Boolean)),
      ]

      if (subjectIds.length === 0) {
        setSubjects([])
        setSubjectNotes({})
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('subjects')
        .select('id, name, topics(id, name, class_id)')
        .in('id', subjectIds)
        .order('name')

      if (fetchError) {
        setError(fetchError.message)
        setSubjects([])
        setSubjectNotes({})
      } else {
        const rows = data ?? []
        setSubjects(rows)
        await fetchSubjectNotes(rows.map((s) => s.id), selectedClassId)
      }
      setLoading(false)
      return
    }

    if (userRole === 'student' || userRole === 'parent') {
      if (!studentClassId) {
        setSubjects([])
        setSubjectTeacherMap({})
        setSubjectNotes({})
        setLoading(false)
        return
      }

      const { data: scData } = await supabase
        .from('subject_classes')
        .select('subject_id')
        .eq('class_id', studentClassId)

      const subjectIds = scData?.map((sc) => sc.subject_id) ?? []

      if (subjectIds.length === 0) {
        setSubjects([])
        setSubjectTeacherMap({})
        setSubjectNotes({})
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('subjects')
        .select('id, name, topics(id, name, class_id), subject_classes(class_id, classes(name))')
        .in('id', subjectIds)
        .order('name')

      if (fetchError) {
        setError(fetchError.message)
        setSubjects([])
        setSubjectTeacherMap({})
        setSubjectNotes({})
      } else {
        const rows = data ?? []
        setSubjects(rows)

        const { data: ctData } = await supabase
          .from('class_teachers')
          .select('subject_id, teacher_id, users(name, email)')
          .eq('class_id', studentClassId)

        const teacherMap = {}
        for (const ct of ctData ?? []) {
          teacherMap[ct.subject_id] = ct.users
        }
        setSubjectTeacherMap(teacherMap)
        await fetchSubjectNotes(rows.map((s) => s.id), studentClassId)
      }
      setLoading(false)
      return
    }

    let query = supabase
      .from('subjects')
      .select('id, name, teacher_id, topics(id, name, class_id), users(name), subject_classes(class_id, classes(name))')
      .order('name')
      .eq('institute_id', instituteId)

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      setSubjects([])
      setSubjectNotes({})
    } else {
      const rows = data ?? []
      setSubjects(rows)
      await fetchSubjectNotes(rows.map((s) => s.id), selectedClassId)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!userRole) return
    if ((userRole === 'teacher' || userRole === 'admin') && !classesLoaded) return
    if (userRole === 'teacher') {
      setLoading(true)
      fetchSubjects()
      return
    }
    if (userRole === 'student' || userRole === 'parent') {
      setLoading(true)
      fetchSubjects()
      return
    }
    if (userRole === 'admin' && !instituteId) return
    setLoading(true)
    fetchSubjects()
  }, [userRole, instituteId, studentClassId, teacherAssignments, classesLoaded, selectedClassId])

  function getClassTopics(subject) {
    const classId = isStudentView ? studentClassId : selectedClassId
    if (!classId) {
      if (isAdmin) return subject.topics ?? []
      return subject.topics?.filter((t) => t.class_id === null) ?? []
    }
    return (
      subject.topics?.filter(
        (t) => t.class_id === classId || t.class_id === null
      ) ?? []
    )
  }

  const classSubjectIds = teacherAssignments
    .filter((a) => a.class_id === selectedClassId)
    .map((a) => a.subject_id)

  const displayedSubjects = isTeacher
    ? subjects.filter((s) => classSubjectIds.includes(s.id))
    : selectedClassId
      ? subjects.filter((s) =>
          s.subject_classes?.some((sc) => sc.class_id === selectedClassId)
        )
      : subjects

  async function handleCreateSubject(e) {
    e.preventDefault()
    const name = subjectName.trim()
    if (!name) return

    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message ?? 'Not authenticated')
      }

      const { data: newSubject, error: insertError } = await supabase
        .from('subjects')
        .insert({ name, institute_id: instituteId, teacher_id: user.id })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      if (selectedClassIdsForSubject.length > 0) {
        const subjectClassRows = selectedClassIdsForSubject.map((classId) => ({
          subject_id: newSubject.id,
          class_id: classId,
        }))
        const { error: scError } = await supabase.from('subject_classes').insert(subjectClassRows)
        if (scError) throw new Error(scError.message)
      }

      setSubjectName('')
      setSelectedClassIdsForSubject([])
      setLoading(true)
      await fetchSubjects()
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  function openAddTopic(subjectId) {
    setShowAddTopic(subjectId)
    setManageClassesSubjectId(null)
    setTopicInput('')
  }

  function toggleManageClasses(subject) {
    setManageClassesSubjectId((prev) => (prev === subject.id ? null : subject.id))
    setManageClassIds(subject.subject_classes?.map((sc) => sc.class_id) ?? [])
    setShowAddTopic(null)
  }

  async function handleSaveClassAssignments(subjectId) {
    const subject = subjects.find((s) => s.id === subjectId)
    const currentIds = subject?.subject_classes?.map((sc) => sc.class_id) ?? []
    const toAdd = manageClassIds.filter((id) => !currentIds.includes(id))
    const toRemove = currentIds.filter((id) => !manageClassIds.includes(id))

    setSavingClassAssignments(true)
    setError(null)

    try {
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('subject_classes')
          .delete()
          .eq('subject_id', subjectId)
          .in('class_id', toRemove)
        if (deleteError) throw new Error(deleteError.message)
      }

      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('subject_classes').insert(
          toAdd.map((classId) => ({ subject_id: subjectId, class_id: classId }))
        )
        if (insertError) throw new Error(insertError.message)
      }

      setManageClassesSubjectId(null)
      setLoading(true)
      await fetchSubjects()
    } catch (err) {
      setError(err.message)
    }

    setSavingClassAssignments(false)
  }

  async function handlePdfUpload(e, subjectId) {
    const file = e.target.files?.[0]
    if (!file) return

    setExtractingId(subjectId)
    setExtractedSubjectId(subjectId)
    setExtractError(null)
    setSuggestedTopics([])
    setSelectedTopics([])

    try {
      const form = new FormData()
      form.append('file', file)

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/extract-topics`,
        { method: 'POST', body: form }
      )

      const data = await response.json()
      const topics = data.topics ?? []
      setSuggestedTopics(topics)
      setSelectedTopics(topics)
    } catch {
      setExtractError('Failed to extract topics. Try a smaller PDF.')
    } finally {
      setExtractingId(null)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  async function handleSaveSuggestedTopics(subjectId) {
    if (selectedTopics.length === 0) return
    setSavingTopics(true)

    const rows = selectedTopics.map((name, i) => ({
      name,
      subject_id: subjectId,
      class_id: selectedClassId || null,
      order_index: i,
    }))

    const { error } = await supabase.from('topics').insert(rows)

    if (error) {
      setExtractError(error.message)
    } else {
      setSuggestedTopics([])
      setSelectedTopics([])
      setExtractedSubjectId(null)
      setShowAddTopic(null)
      setLoading(true)
      await fetchSubjects()
    }
    setSavingTopics(false)
  }

  function toggleTopicSelection(topic) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  async function handleAddTopic(subjectId) {
    const name = topicInput.trim()
    if (!name) return

    setTopicSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('topics').insert({
      name,
      subject_id: subjectId,
      class_id: selectedClassId || null,
    })

    setTopicSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setTopicInput('')
    setShowAddTopic(null)
    setLoading(true)
    await fetchSubjects()
  }

  async function handleDeleteSubject(subjectId, subjectName) {
    if (!window.confirm(`Delete "${subjectName}"?`)) return
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
      if (error) throw new Error(error.message)
      await fetchSubjects()
    } catch (err) {
      alert('Error deleting subject: ' + err.message)
    }
  }

  const showSubjectList = isStudentView || isAdmin || selectedClassId

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subjects</h1>

      {selectedClassId && (
        <p className="text-sm text-gray-500 mb-4">
          {availableClasses.find((c) => c.id === selectedClassId)?.name}
        </p>
      )}

      {isAdmin && (
        <form
          onSubmit={handleCreateSubject}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Create Subject</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Subject name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {availableClasses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Classes (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        selectedClassIdsForSubject.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIdsForSubject.includes(c.id)}
                        onChange={() =>
                          setSelectedClassIdsForSubject((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          )
                        }
                        className="hidden"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {!isStudentView && availableClasses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {availableClasses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedClassId(c.id)
                setShowAddTopic(null)
                setManageClassesSubjectId(null)
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

      {isTeacher && !selectedClassId && (
        <p className="text-sm text-gray-500">
          Select a class to view subjects and topics.
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {showSubjectList && (
        loading ? (
          <p className="text-gray-500 text-sm">Loading subjects…</p>
        ) : displayedSubjects.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {isAdmin
              ? 'No subjects yet. Create one above.'
              : isTeacher
                ? 'No subjects assigned to you in this class.'
                : 'No subjects yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {displayedSubjects.map((subject) => {
              const classTopics = getClassTopics(subject)
              return (
                <li
                  key={subject.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                >
                  {isStudentView ? (
                    <>
                      <p className="font-medium text-gray-900">{subject.name}</p>
                      {subjectTeacherMap[subject.id] && (
                        <p className="text-xs text-gray-500 mt-1">
                          Teacher: {subjectTeacherMap[subject.id].name}
                        </p>
                      )}

                      {classTopics.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {classTopics.map((topic) => (
                            <li
                              key={topic.id}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                            >
                              {topic.name}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">
                          📎 Notes & Files
                        </p>
                        {(subjectNotes[subject.id] ?? []).length > 0 ? (
                          <div className="space-y-2">
                            {(subjectNotes[subject.id] ?? []).map((note) => (
                              <a
                                key={note.id}
                                href={note.url.startsWith('http') ? note.url : `https://${note.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
                              >
                                <span>📄</span>
                                <span className="truncate font-medium">{note.title}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">
                            No files uploaded yet.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{subject.name}</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(subject.id, subject.name)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        {subject.subject_classes?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {subject.subject_classes.map((sc) => (
                              <span
                                key={sc.class_id}
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200"
                              >
                                {sc.classes?.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleManageClasses(subject)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {manageClassesSubjectId === subject.id
                                ? 'Hide Classes'
                                : 'Manage Classes'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              pdfRef.current.dataset.subjectId = subject.id
                              pdfRef.current.click()
                            }}
                            disabled={extractingId === subject.id}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-40"
                          >
                            {extractingId === subject.id ? 'Extracting…' : '📄 Extract from PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddTopic(subject.id)}
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            + Add Topic
                          </button>
                        </div>
                      </div>

                      {isAdmin && manageClassesSubjectId === subject.id && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-700 mb-2">Assign to Classes</p>
                          {availableClasses.length === 0 ? (
                            <p className="text-sm text-gray-400">No classes available.</p>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {availableClasses.map((c) => (
                                  <label
                                    key={c.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                                      manageClassIds.includes(c.id)
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={manageClassIds.includes(c.id)}
                                      onChange={() =>
                                        setManageClassIds((prev) =>
                                          prev.includes(c.id)
                                            ? prev.filter((id) => id !== c.id)
                                            : [...prev, c.id]
                                        )
                                      }
                                      className="hidden"
                                    />
                                    {c.name}
                                  </label>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSaveClassAssignments(subject.id)}
                                disabled={savingClassAssignments}
                                className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                              >
                                {savingClassAssignments ? 'Saving…' : 'Save Class Assignments'}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {classTopics.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {classTopics.map((topic) => (
                            <li
                              key={topic.id}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                            >
                              {topic.name}
                            </li>
                          ))}
                        </ul>
                      )}

                      {!isStudentView && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-600">
                              📎 Notes & Files
                            </p>
                            {isTeacher && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingNoteFor(subject.id)
                                  setNoteTitle('')
                                  setNoteUrl('')
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                + Upload Link
                              </button>
                            )}
                          </div>

                          {addingNoteFor === subject.id && (
                            <div className="flex flex-col gap-2 mb-3 p-3 bg-blue-50 rounded-lg">
                              <input
                                type="text"
                                value={noteTitle}
                                onChange={(e) => setNoteTitle(e.target.value)}
                                placeholder="Title (e.g. Chapter 4 Notes, Practice Questions)"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                              />
                              <input
                                type="url"
                                value={noteUrl}
                                onChange={(e) => setNoteUrl(e.target.value)}
                                placeholder="Paste link (Google Drive, YouTube, PDF URL...)"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!noteTitle.trim() || !noteUrl.trim()) return
                                    setSavingNote(true)
                                    const { data: userData } = await supabase.auth.getUser()
                                    await supabase.from('subject_notes').insert({
                                      subject_id: subject.id,
                                      class_id: selectedClassId || null,
                                      title: noteTitle.trim(),
                                      url: noteUrl.trim(),
                                      uploaded_by: userData.user.id,
                                    })
                                    setAddingNoteFor(null)
                                    setNoteTitle('')
                                    setNoteUrl('')
                                    await fetchSubjectNotes(
                                      subjects.map((s) => s.id),
                                      selectedClassId
                                    )
                                    setSavingNote(false)
                                  }}
                                  disabled={savingNote || !noteTitle.trim() || !noteUrl.trim()}
                                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                                >
                                  {savingNote ? 'Saving...' : 'Upload'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddingNoteFor(null)}
                                  className="text-gray-500 text-xs px-3 py-1.5"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {(subjectNotes[subject.id] ?? []).length > 0 ? (
                            <div className="space-y-2">
                              {(subjectNotes[subject.id] ?? []).map((note) => (
                                <div
                                  key={note.id}
                                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                                >
                                  <a
                                    href={note.url.startsWith('http') ? note.url : `https://${note.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 flex-1 min-w-0"
                                  >
                                    <span>📄</span>
                                    <span className="truncate font-medium">{note.title}</span>
                                  </a>
                                  {isTeacher && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await supabase.from('subject_notes')
                                          .delete()
                                          .eq('id', note.id)
                                        await fetchSubjectNotes(
                                          subjects.map((s) => s.id),
                                          selectedClassId
                                        )
                                      }}
                                      className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-2"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              No files uploaded yet.
                            </p>
                          )}
                        </div>
                      )}

                      {suggestedTopics.length > 0 && extractedSubjectId === subject.id && (
                        <div className="mt-4 pt-4 border-t border-purple-100 bg-purple-50 rounded-lg p-4">
                          <p className="text-sm font-semibold text-purple-900 mb-3">
                            Gemini extracted {suggestedTopics.length} topics — select which to add:
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {suggestedTopics.map((topic) => (
                              <button
                                key={topic}
                                type="button"
                                onClick={() => toggleTopicSelection(topic)}
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                                  selectedTopics.includes(topic)
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-white text-gray-600 border-gray-300'
                                }`}
                              >
                                {topic}
                              </button>
                            ))}
                          </div>
                          {extractError && <p className="text-xs text-red-600 mb-2">{extractError}</p>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveSuggestedTopics(subject.id)}
                              disabled={savingTopics || selectedTopics.length === 0}
                              className="text-sm font-medium bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
                            >
                              {savingTopics ? 'Saving…' : `Add ${selectedTopics.length} topics`}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSuggestedTopics([])
                                setSelectedTopics([])
                                setExtractedSubjectId(null)
                                setExtractError(null)
                              }}
                              className="text-sm font-medium text-gray-500 px-4 py-2 rounded-lg hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {showAddTopic === subject.id && (
                        <div className="mt-3 flex flex-col gap-2">
                          <input
                            type="text"
                            value={topicInput}
                            onChange={(e) => setTopicInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddTopic(subject.id)
                              }
                            }}
                            placeholder="Topic name"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddTopic(subject.id)}
                              disabled={topicSaving}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                            >
                              {topicSaving ? 'Saving…' : 'Save Topic'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddTopic(null)
                                setTopicInput('')
                              }}
                              className="text-gray-500 text-sm px-3 py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )
      )}

      {!isStudentView && (
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const subjectId = pdfRef.current?.dataset?.subjectId
            if (subjectId) handlePdfUpload(e, subjectId)
          }}
        />
      )}
    </>
  )
}
