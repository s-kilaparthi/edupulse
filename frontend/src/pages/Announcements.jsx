import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

function getTargetLabel(announcement) {
  switch (announcement.target_type) {
    case 'everyone':
      return '🌐 Everyone'
    case 'all_teachers':
      return '👩‍🏫 All Teachers'
    case 'all_students':
      return '👨‍🎓 All Students'
    case 'class_students':
      return '📚 Class Students'
    case 'class_teachers':
      return '🏫 Class Teachers'
    case 'subject_teachers':
      return '📖 Subject Teachers'
    case 'specific_teacher':
      return '👤 Specific Teacher'
    case 'specific_student':
      return '👤 Specific Student'
    default:
      return 'Institute-wide'
  }
}

function studentCanSeeAnnouncement(announcement, studentClassId, studentId) {
  const { target_type, target_ids } = announcement
  const ids = target_ids ?? []
  if (target_type === 'everyone' || target_type === 'all_students') return true
  if (target_type === 'class_students' && studentClassId) {
    return ids.includes(studentClassId)
  }
  if (target_type === 'specific_student') {
    return ids.includes(studentId)
  }
  if (!target_type) return true
  return false
}

function AnnouncementCard({
  item,
  editingAnnouncementId,
  editTitle,
  setEditTitle,
  editBody,
  setEditBody,
  editPinned,
  setEditPinned,
  savingEdit,
  canEditItem,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) {
  const pinnedCard = item.is_pinned
  const isEditing = editingAnnouncementId === item.id

  return (
    <div
      className={`rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden break-words ${
        pinnedCard ? 'bg-yellow-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {!isEditing && (
            <>
              {pinnedCard && (
                <span className="text-xs text-yellow-600 font-medium">📌 Pinned</span>
              )}
              <h3 className="font-semibold text-gray-900 break-words">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1 break-words">{item.body}</p>
            </>
          )}
        </div>
        {canEditItem && !isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onStartEdit}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
          <input
            key={`edit-title-${editingAnnouncementId}`}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Title"
            autoComplete="off"
          />
          <textarea
            key={`edit-body-${editingAnnouncementId}`}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="Body"
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editPinned}
              onChange={(e) => setEditPinned(e.target.checked)}
              className="rounded border-gray-300"
            />
            📌 Pin this announcement
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={savingEdit}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {savingEdit ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-gray-500 text-sm px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        <span>By {item.users?.name}</span>
        <span>· {getTargetLabel(item)}</span>
        <span>· {new Date(item.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

export default function Announcements() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('student')
  const [userName, setUserName] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [studentClassId, setStudentClassId] = useState(null)
  const isAdmin = userRole === 'admin'
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editPinned, setEditPinned] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [targetType, setTargetType] = useState('everyone')
  const [targetIds, setTargetIds] = useState([])
  const [targetSubjectIds, setTargetSubjectIds] = useState([])
  const [teacherClasses, setTeacherClasses] = useState([])
  const [teacherTargetClassIds, setTeacherTargetClassIds] = useState([])
  const [teacherAnnouncementTarget, setTeacherAnnouncementTarget] = useState('students')
  const [teacherSpecificStudentRoll, setTeacherSpecificStudentRoll] = useState('')
  const [teacherSpecificStudent, setTeacherSpecificStudent] = useState(null)
  const [studentSearchForAnnouncement, setStudentSearchForAnnouncement] = useState('')
  const [foundAnnouncementStudent, setFoundAnnouncementStudent] = useState(null)
  const [teacherAnnouncementTab, setTeacherAnnouncementTab] = useState('institute')

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role, name, institute_id, class_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role)
          setUserName(data.name)
          setInstituteId(data.institute_id)
          if (data.role === 'student') {
            setStudentClassId(data.class_id)
          }
        }
      })
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || !instituteId) return
    if (userRole !== 'teacher' && userRole !== 'admin') return

    if (userRole === 'admin') {
      Promise.all([
        supabase
          .from('subjects')
          .select('id, name')
          .eq('institute_id', instituteId)
          .order('name'),
        supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', instituteId)
          .order('name'),
        supabase
          .from('users')
          .select('id, name')
          .eq('role', 'teacher')
          .eq('institute_id', instituteId)
          .order('name'),
      ]).then(([subjectsRes, classesRes, teachersRes]) => {
        if (subjectsRes.data) setSubjects(subjectsRes.data)
        if (classesRes.data) setClasses(classesRes.data)
        if (teachersRes.data) setTeachers(teachersRes.data)
      })
    } else if (userRole === 'teacher') {
      supabase
        .from('subjects')
        .select('id, name')
        .eq('teacher_id', session.user.id)
        .order('name')
        .then(({ data }) => {
          if (data) setSubjects(data)
        })
    }
  }, [userRole, session, instituteId])

  useEffect(() => {
    if (userRole !== 'teacher' || !session?.user?.id) return
    supabase
      .from('class_teachers')
      .select('class_id, classes(id, name)')
      .eq('teacher_id', session.user.id)
      .then(({ data }) => {
        const seen = new Set()
        const unique = []
        for (const row of data ?? []) {
          if (row.classes && !seen.has(row.class_id)) {
            seen.add(row.class_id)
            unique.push(row.classes)
          }
        }
        setTeacherClasses(unique)
      })
  }, [userRole, session])

  const loadAnnouncements = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)

    const { data, error } = await supabase.rpc('get_my_announcements')

    if (error) {
      console.error('Announcements error:', error)
      setAnnouncements([])
      setLoading(false)
      return
    }

    const rows = data ?? []

    const creatorIds = [...new Set(rows.map((a) => a.created_by).filter(Boolean))]

    const creatorMap = {}
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('users')
        .select('id, name, role')
        .in('id', creatorIds)

      for (const c of creators ?? []) {
        creatorMap[c.id] = c
      }
    }

    const enriched = rows.map((a) => ({
      ...a,
      users: creatorMap[a.created_by] ?? null,
    }))

    setAnnouncements(enriched)
    setLoading(false)
  }, [session])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  async function handlePost(e) {
    e.preventDefault()
    if (!newTitle.trim() || !session?.user?.id || !instituteId) return

    const needsTargets = [
      'class_students',
      'class_teachers',
      'subject_teachers',
      'specific_teacher',
      'specific_student',
    ].includes(targetType)

    if (isAdmin && needsTargets && targetIds.length === 0) {
      setError('Please select at least one target.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'class_students' && teacherTargetClassIds.length === 0) {
      setError('Please select at least one class.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'specific_student' && !teacherSpecificStudent) {
      setError('Please find a student by roll number.')
      return
    }

    setSaving(true)
    setError(null)

    let finalTargetType = targetType
    let finalTargetIds = targetIds

    if (userRole === 'teacher') {
      if (teacherAnnouncementTarget === 'everyone') {
        finalTargetType = 'class_students'
        finalTargetIds = teacherClasses.map((c) => c.id)
      } else if (teacherAnnouncementTarget === 'students') {
        finalTargetType = 'class_students'
        finalTargetIds =
          teacherTargetClassIds.length === 0
            ? teacherClasses.map((c) => c.id)
            : teacherTargetClassIds
      } else if (teacherAnnouncementTarget === 'class_students') {
        finalTargetType = 'class_students'
        finalTargetIds = teacherTargetClassIds
      } else if (teacherAnnouncementTarget === 'specific_student') {
        finalTargetType = 'specific_student'
        finalTargetIds = teacherSpecificStudent ? [teacherSpecificStudent.id] : []
      }
    }

    const insertPayload = {
      title: newTitle,
      body: newBody,
      is_pinned: isPinned,
      created_by: session.user.id,
      institute_id: instituteId,
      target_type: finalTargetType,
      target_ids: finalTargetIds,
    }

    const { error: insertError } = await supabase.from('announcements').insert(insertPayload)

    if (!insertError) {
      setNewTitle('')
      setNewBody('')
      setIsPinned(false)
      setTargetType('everyone')
      setTargetIds([])
      setTargetSubjectIds([])
      setTeacherTargetClassIds([])
      setTeacherAnnouncementTarget('students')
      setTeacherSpecificStudentRoll('')
      setTeacherSpecificStudent(null)
      setStudentSearchForAnnouncement('')
      setFoundAnnouncementStudent(null)
      setShowForm(false)
      await loadAnnouncements()
    } else {
      setError(insertError.message)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (editingAnnouncementId === id) setEditingAnnouncementId(null)
    await supabase.from('announcements').delete().eq('id', id)
    await loadAnnouncements()
  }

  async function handleSaveEdit(announcementId) {
    setSavingEdit(true)
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        title: editTitle,
        body: editBody,
        is_pinned: editPinned,
      })
      .eq('id', announcementId)

    if (!updateError) {
      setEditingAnnouncementId(null)
      await loadAnnouncements()
    } else {
      setError(updateError.message)
    }
    setSavingEdit(false)
  }

  const canEdit = (announcement) =>
    userRole === 'admin' ||
    (userRole === 'teacher' && announcement.created_by === session.user.id)

  const instituteAnnouncements = announcements.filter(
    (a) => a.created_by !== session?.user?.id
  )

  const myAnnouncements = announcements.filter(
    (a) => a.created_by === session?.user?.id
  )

  const displayedAnnouncements =
    userRole === 'teacher'
      ? teacherAnnouncementTab === 'institute'
        ? instituteAnnouncements
        : myAnnouncements
      : userRole === 'student'
        ? announcements.filter((a) =>
            studentCanSeeAnnouncement(a, studentClassId, session?.user?.id)
          )
        : announcements

  const pinned = displayedAnnouncements.filter((a) => a.is_pinned)
  const regular = displayedAnnouncements.filter((a) => !a.is_pinned)

  function renderAnnouncementCard(item) {
    return (
      <AnnouncementCard
        key={item.id}
        item={item}
        editingAnnouncementId={editingAnnouncementId}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editBody={editBody}
        setEditBody={setEditBody}
        editPinned={editPinned}
        setEditPinned={setEditPinned}
        savingEdit={savingEdit}
        canEditItem={canEdit(item)}
        onStartEdit={() => {
          setEditingAnnouncementId(item.id)
          setEditTitle(item.title)
          setEditBody(item.body ?? '')
          setEditPinned(item.is_pinned ?? false)
        }}
        onCancelEdit={() => setEditingAnnouncementId(null)}
        onSaveEdit={() => handleSaveEdit(item.id)}
        onDelete={() => handleDelete(item.id)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500">Welcome, {userName}</p>
        </div>
        {(userRole !== 'teacher' || teacherAnnouncementTab === 'mine') && isTeacher && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1"
          >
            {showForm ? 'Cancel' : '+ Create Announcement'}
          </button>
        )}
      </div>

      {userRole === 'teacher' && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTeacherAnnouncementTab('institute')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              teacherAnnouncementTab === 'institute'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            📢 From Institute
          </button>
          <button
            type="button"
            onClick={() => setTeacherAnnouncementTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              teacherAnnouncementTab === 'mine'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            📝 My Announcements
          </button>
        </div>
      )}

      {(userRole !== 'teacher' || teacherAnnouncementTab === 'mine') && isTeacher && showForm && (
        <form
          onSubmit={handlePost}
          className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">Post Announcement</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Announcement title"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Body</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              placeholder="Write your announcement…"
            />
          </div>

          {userRole === 'teacher' && teacherClasses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send To
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('students')
                    setTeacherTargetClassIds([])
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'students'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  My Students
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherAnnouncementTarget('class_students')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'class_students'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Specific Class Students
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherAnnouncementTarget('specific_student')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'specific_student'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  👤 Specific Student
                </button>
              </div>

              {teacherAnnouncementTarget === 'class_students' && (
                <div className="flex flex-wrap gap-2">
                  {teacherClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        teacherTargetClassIds.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={teacherTargetClassIds.includes(c.id)}
                        onChange={() =>
                          setTeacherTargetClassIds((prev) =>
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
              )}

              {teacherAnnouncementTarget === 'specific_student' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={teacherSpecificStudentRoll}
                    onChange={async (e) => {
                      setTeacherSpecificStudentRoll(e.target.value)
                      if (e.target.value.trim().length >= 1) {
                        const { data } = await supabase
                          .from('users')
                          .select('id, name, roll_number')
                          .eq('role', 'student')
                          .eq('roll_number', e.target.value.trim())
                          .single()
                        setTeacherSpecificStudent(data ?? null)
                      } else {
                        setTeacherSpecificStudent(null)
                      }
                    }}
                    placeholder="Enter roll number..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {teacherSpecificStudent && (
                    <p className="text-xs text-green-700 mt-1 font-medium">
                      Found: {teacherSpecificStudent.name}
                      {' '}(Roll #{teacherSpecificStudent.roll_number})
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send To
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { value: 'everyone', label: '🌐 Everyone' },
                  { value: 'all_teachers', label: '👩‍🏫 All Teachers' },
                  { value: 'all_students', label: '👨‍🎓 All Students' },
                  { value: 'class_students', label: '📚 Specific Classes (Students)' },
                  { value: 'class_teachers', label: '🏫 Class Teachers' },
                  { value: 'subject_teachers', label: '📖 Subject Teachers' },
                  { value: 'specific_teacher', label: '👤 Specific Teacher' },
                  { value: 'specific_student', label: '👤 Specific Student' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTargetType(opt.value)
                      setTargetIds([])
                      setTargetSubjectIds([])
                      setStudentSearchForAnnouncement('')
                      setFoundAnnouncementStudent(null)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      targetType === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(targetType === 'class_students' || targetType === 'class_teachers') && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <p className="w-full text-xs text-gray-500 mb-1">Select classes:</p>
                  {classes.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(c.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetIds.includes(c.id)}
                        onChange={() =>
                          setTargetIds((prev) =>
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
              )}

              {targetType === 'subject_teachers' && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <p className="w-full text-xs text-gray-500 mb-1">Select subjects:</p>
                  {subjects.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(s.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetIds.includes(s.id)}
                        onChange={() =>
                          setTargetIds((prev) =>
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
              )}

              {targetType === 'specific_teacher' && (
                <select
                  value={targetIds[0] ?? ''}
                  onChange={(e) => setTargetIds([e.target.value])}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              {targetType === 'specific_student' && (
                <div>
                  <input
                    type="text"
                    value={studentSearchForAnnouncement}
                    onChange={async (e) => {
                      setStudentSearchForAnnouncement(e.target.value)
                      if (e.target.value.trim().length >= 2) {
                        const { data } = await supabase
                          .from('users')
                          .select('id, name, roll_number')
                          .eq('role', 'student')
                          .eq('institute_id', instituteId)
                          .eq('roll_number', e.target.value.trim())
                          .single()
                        setFoundAnnouncementStudent(data)
                        if (data) setTargetIds([data.id])
                      } else {
                        setFoundAnnouncementStudent(null)
                        setTargetIds([])
                      }
                    }}
                    placeholder="Enter student roll number..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {foundAnnouncementStudent && (
                    <p className="text-xs text-green-700 mt-1 font-medium">
                      Found: {foundAnnouncementStudent.name}
                      {' '}(Roll #{foundAnnouncementStudent.roll_number})
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-gray-300"
            />
            Pin this announcement
          </label>

          <button
            type="submit"
            disabled={saving || !newTitle.trim()}
            className="bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-40"
          >
            {saving ? 'Posting…' : 'Post'}
          </button>
        </form>
      )}

      {loading && (
        <p className="text-sm text-gray-500">Loading announcements…</p>
      )}

      {!loading && displayedAnnouncements.length === 0 && (
        <p className="text-sm text-gray-500">No announcements yet.</p>
      )}

      {!loading && pinned.length > 0 && (
        <div className="flex flex-col gap-3">
          {pinned.map((item) => renderAnnouncementCard(item))}
        </div>
      )}

      {!loading && regular.length > 0 && (
        <div className="flex flex-col gap-3">
          {regular.map((item) => renderAnnouncementCard(item))}
        </div>
      )}
    </div>
  )
}
