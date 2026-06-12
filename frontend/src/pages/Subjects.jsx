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
  const [sharePopoverNoteId, setSharePopoverNoteId] = useState(null)
  const [sharedClassMap, setSharedClassMap] = useState({})
  const [sharingNoteId, setSharingNoteId] = useState(null)
  const topicInputRef = useRef(null)
  const sharePopoverRef = useRef(null)

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
    if (!subjectIds?.length) return

    // Query 1: notes for specific class
    const { data: classNotes } = await supabase
      .from('subject_notes')
      .select('id, subject_id, title, url, created_at, class_id, uploaded_by')
      .in('subject_id', subjectIds)
      .eq('class_id', classId || '')

    // Query 2: notes with null class_id (admin/institute-wide)
    const { data: globalNotes } = await supabase
      .from('subject_notes')
      .select('id, subject_id, title, url, created_at, class_id, uploaded_by')
      .in('subject_id', subjectIds)
      .is('class_id', null)

    const combined = [...(classNotes ?? []), ...(globalNotes ?? [])]
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const map = {}
    for (const note of combined) {
      if (!map[note.subject_id]) map[note.subject_id] = []
      map[note.subject_id].push(note)
    }
    setSubjectNotes(map)
  }

  function getShareableClassesForNote(subjectId, sourceClassId) {
    const classIdsForSubject = [
      ...new Set(
        teacherAssignments
          .filter((a) => a.subject_id === subjectId)
          .map((a) => a.class_id)
      ),
    ]
    return availableClasses.filter(
      (c) => classIdsForSubject.includes(c.id) && c.id !== sourceClassId
    )
  }

  async function loadSharedClassesForNote(note) {
    const { data } = await supabase
      .from('subject_notes')
      .select('id, class_id')
      .eq('subject_id', note.subject_id)
      .eq('title', note.title)
      .eq('url', note.url)
      .eq('uploaded_by', session.user.id)

    const map = {}
    for (const row of data ?? []) {
      if (row.class_id && row.class_id !== note.class_id) {
        map[row.class_id] = row.id
      }
    }
    return map
  }

  function closeSharePopover() {
    setSharePopoverNoteId(null)
  }

  async function toggleSharePopover(note) {
    if (sharePopoverNoteId === note.id) {
      closeSharePopover()
      return
    }

    const map = await loadSharedClassesForNote(note)
    setSharedClassMap((prev) => ({ ...prev, [note.id]: map }))
    setSharePopoverNoteId(note.id)
  }

  async function handleShareClassToggle(note, classId) {
    const shared = sharedClassMap[note.id] ?? {}
    const existingId = shared[classId]

    setSharingNoteId(note.id)

    if (existingId) {
      await supabase.from('subject_notes').delete().eq('id', existingId)
      setSharedClassMap((prev) => {
        const next = { ...(prev[note.id] ?? {}) }
        delete next[classId]
        return { ...prev, [note.id]: next }
      })
    } else {
      const { data, error: insertError } = await supabase
        .from('subject_notes')
        .insert({
          subject_id: note.subject_id,
          class_id: classId,
          title: note.title,
          url: note.url,
          uploaded_by: session.user.id,
        })
        .select('id')
        .single()

      if (!insertError && data) {
        setSharedClassMap((prev) => ({
          ...prev,
          [note.id]: { ...(prev[note.id] ?? {}), [classId]: data.id },
        }))
      }
    }

    await fetchSubjectNotes(
      subjects.map((s) => s.id),
      selectedClassId
    )
    setSharingNoteId(null)
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

  useEffect(() => {
    if (showAddTopic) {
      topicInputRef.current?.focus()
    }
  }, [showAddTopic])

  useEffect(() => {
    if (!sharePopoverNoteId) return

    function handleClickOutside(e) {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(e.target)) {
        setSharePopoverNoteId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sharePopoverNoteId])

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

  function closeAddTopicPanel() {
    setShowAddTopic(null)
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

    const { data: newTopic, error: insertError } = await supabase
      .from('topics')
      .insert({
        name,
        subject_id: subjectId,
        class_id: selectedClassId || null,
      })
      .select('id, name, class_id')
      .single()

    setTopicSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, topics: [...(s.topics ?? []), newTopic] }
          : s
      )
    )
    setTopicInput('')
    topicInputRef.current?.focus()
  }

  async function handleDeleteTopic(subjectId, topicId) {
    setError(null)

    const { error: deleteError } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, topics: (s.topics ?? []).filter((t) => t.id !== topicId) }
          : s
      )
    )
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Subjects</h1>

      {selectedClassId && (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mb-4">
          {availableClasses.find((c) => c.id === selectedClassId)?.name}
        </p>
      )}

      {isAdmin && (
        <form
          onSubmit={handleCreateSubject}
          className="bg-white dark:bg-[#1C1C1C] rounded-xl border border-gray-200 dark:border-[#363636] p-6 shadow-sm mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">Create Subject</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Subject name"
                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                  Assign to Classes (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        selectedClassIdsForSubject.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 dark:border-[#363636] text-gray-700 dark:text-[#A8A8A8] hover:border-gray-400'
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
                  : 'bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#363636] text-gray-600 dark:text-[#A8A8A8] hover:border-gray-400'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isTeacher && !selectedClassId && (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">
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
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">Loading subjects…</p>
        ) : displayedSubjects.length === 0 ? (
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">
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
                  className="bg-white dark:bg-[#1C1C1C] rounded-xl border border-gray-200 dark:border-[#363636] p-4 shadow-sm"
                >
                  {isStudentView ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-[#FFFFFF]">{subject.name}</p>
                      {subjectTeacherMap[subject.id] && (
                        <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-1">
                          Teacher: {subjectTeacherMap[subject.id].name}
                        </p>
                      )}

                      {classTopics.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {classTopics.map((topic) => (
                            <li
                              key={topic.id}
                              className="text-xs bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] px-2 py-1 rounded-md"
                            >
                              {topic.name}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-3 border-t border-gray-100 dark:border-[#363636] pt-3">
                        <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">
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
                          <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">
                            No files uploaded yet.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-[#FFFFFF]">{subject.name}</span>
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
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#363636]">
                          <p className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Assign to Classes</p>
                          {availableClasses.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No classes available.</p>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {availableClasses.map((c) => (
                                  <label
                                    key={c.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                                      manageClassIds.includes(c.id)
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                                        : 'border-gray-300 dark:border-[#363636] text-gray-700 dark:text-[#A8A8A8] hover:border-gray-400'
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
                              className="text-xs bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] px-2 py-1 rounded-md"
                            >
                              {topic.name}
                            </li>
                          ))}
                        </ul>
                      )}

                      {!isStudentView && (
                        <div className="mt-3 border-t border-gray-100 dark:border-[#363636] pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8]">
                              📎 Notes & Files
                            </p>
                            {(isTeacher || isAdmin) && (
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
                                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-xs dark:bg-[#262626]"
                              />
                              <input
                                type="url"
                                value={noteUrl}
                                onChange={(e) => setNoteUrl(e.target.value)}
                                placeholder="Paste link (Google Drive, YouTube, PDF URL...)"
                                className="w-full rounded-lg border border-gray-300 dark:border-[#363636] px-3 py-2 text-xs dark:bg-[#262626]"
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
                                      class_id: isAdmin ? null : (selectedClassId || null),
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
                                  className="text-gray-500 dark:text-[#A8A8A8] text-xs px-3 py-1.5"
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
                                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#262626] rounded-lg"
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
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                                      note.class_id == null
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] border border-gray-200 dark:border-[#363636]'
                                    }`}
                                  >
                                    {note.class_id == null
                                      ? '🌐 All Classes'
                                      : availableClasses.find((c) => c.id === note.class_id)?.name ?? 'Class'}
                                  </span>
                                  {isTeacher &&
                                    note.class_id != null &&
                                    note.uploaded_by === session?.user?.id && (
                                    <div
                                      ref={sharePopoverNoteId === note.id ? sharePopoverRef : null}
                                      className="relative shrink-0 ml-2"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggleSharePopover(note)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        Share
                                      </button>
                                      {sharePopoverNoteId === note.id && (
                                        <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#363636] rounded-lg shadow-lg p-2">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-gray-700 dark:text-[#A8A8A8]">
                                              Share to Class
                                            </p>
                                            <button
                                              type="button"
                                              onClick={closeSharePopover}
                                              className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-sm leading-none"
                                              aria-label="Close share dropdown"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                          {getShareableClassesForNote(subject.id, note.class_id).length === 0 ? (
                                            <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">No other classes</p>
                                          ) : (
                                            <ul className="space-y-1">
                                              {getShareableClassesForNote(subject.id, note.class_id).map((cls) => {
                                                const isShared = Boolean(sharedClassMap[note.id]?.[cls.id])
                                                return (
                                                  <li key={cls.id}>
                                                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-[#A8A8A8] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#262626] rounded px-1 py-0.5">
                                                      <input
                                                        type="checkbox"
                                                        checked={isShared}
                                                        disabled={sharingNoteId === note.id}
                                                        onChange={() => handleShareClassToggle(note, cls.id)}
                                                        className="rounded border-gray-300 dark:border-[#363636]"
                                                      />
                                                      <span>{cls.name}</span>
                                                    </label>
                                                  </li>
                                                )
                                              })}
                                            </ul>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {(isTeacher || isAdmin) && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await supabase.from('subject_notes')
                                          .delete()
                                          .eq('id', note.id)
                                        setSharePopoverNoteId((prev) =>
                                          prev === note.id ? null : prev
                                        )
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
                            <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">
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
                                    : 'bg-white dark:bg-[#1C1C1C] text-gray-600 dark:text-[#A8A8A8] border-gray-300 dark:border-[#363636]'
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
                              className="text-sm font-medium text-gray-500 dark:text-[#A8A8A8] px-4 py-2 rounded-lg hover:text-gray-700 dark:text-[#A8A8A8]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {showAddTopic === subject.id && (
                        <div className="mt-4 border border-gray-200 dark:border-[#363636] rounded-lg bg-gray-50 dark:bg-[#262626] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Topics</h3>
                            <button
                              type="button"
                              onClick={closeAddTopicPanel}
                              className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg leading-none"
                              aria-label="Close topics panel"
                            >
                              ✕
                            </button>
                          </div>

                          {classTopics.length > 0 ? (
                            <ul className="space-y-1.5 mb-4">
                              {classTopics.map((topic) => (
                                <li
                                  key={topic.id}
                                  className="flex items-center justify-between gap-2 bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#363636] rounded-lg px-3 py-2"
                                >
                                  <span className="text-sm text-gray-800 dark:text-[#FFFFFF]">{topic.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTopic(subject.id, topic.id)}
                                    className="text-gray-400 dark:text-[#A8A8A8] hover:text-red-600 text-sm shrink-0"
                                    aria-label={`Remove ${topic.name}`}
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-[#A8A8A8] mb-4">No topics yet.</p>
                          )}

                          <div className="flex gap-2 mb-3">
                            <input
                              ref={topicInputRef}
                              type="text"
                              value={topicInput}
                              onChange={(e) => setTopicInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddTopic(subject.id)
                                }
                              }}
                              placeholder="Enter topic name..."
                              className="flex-1 rounded-lg border border-gray-300 dark:border-[#363636] bg-white dark:bg-[#1C1C1C] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-[#262626]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddTopic(subject.id)}
                              disabled={topicSaving || !topicInput.trim()}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                            >
                              {topicSaving ? 'Adding…' : 'Add'}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={closeAddTopicPanel}
                            className="text-sm text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8] font-medium"
                          >
                            Close
                          </button>
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
