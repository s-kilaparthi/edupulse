import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchLinkedStudent } from '../utils/linkedStudent'
import Loader from '../components/Loader'

const GROUP_TARGET_TYPES = ['group_students', 'group_teachers', 'entire_group']

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
    case 'specific_class':
      return `🏫 Specific Classes (${(announcement.target_ids ?? []).length} selected)`
    case 'subject_teachers':
      return '📖 Subject Teachers'
    case 'specific_teacher':
      return `👨‍🏫 Teachers: ${(announcement.target_ids ?? []).length} selected`
    case 'specific_student':
      return `👤 Students: ${(announcement.target_ids ?? []).length} selected`
    case 'group_students':
      return announcement.group_names?.length
        ? `👥 Groups: ${announcement.group_names.join(', ')}`
        : '👥 Group Students'
    case 'group_teachers':
      return announcement.group_names?.length
        ? `👨‍🏫 Group Teachers: ${announcement.group_names.join(', ')}`
        : '👨‍🏫 Group Teachers'
    case 'entire_group':
      return announcement.group_names?.length
        ? `🏫 Entire Groups: ${announcement.group_names.join(', ')}`
        : '🏫 Entire Group'
    default:
      return 'Institute-wide'
  }
}

function studentCanSeeAnnouncement(announcement, studentClassId, studentId, studentGroupIds) {
  const { target_type, target_ids } = announcement
  const ids = target_ids ?? []
  if (target_type === 'everyone' || target_type === 'all_students') return true
  if (target_type === 'class_students' && studentClassId) {
    return ids.includes(studentClassId)
  }
  if (target_type === 'specific_student') {
    return ids.includes(studentId)
  }
  if (target_type === 'specific_class' && studentClassId) {
    return ids.includes(studentClassId)
  }
  if (target_type === 'group_students' || target_type === 'entire_group') {
    if (!studentGroupIds || studentGroupIds.length === 0) return true
    return ids.some((gid) => studentGroupIds.includes(gid))
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
      className={`rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-sm overflow-hidden break-words ${
        pinnedCard ? 'bg-yellow-50' : 'bg-white dark:bg-[#1C1C1C]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {!isEditing && (
            <>
              {pinnedCard && (
                <span className="text-xs text-yellow-600 font-medium">📌 Pinned</span>
              )}
              <h3 className="font-semibold text-gray-900 dark:text-[#FFFFFF] break-words">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mt-1 break-words">{item.body}</p>
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
        <div className="mt-3 flex flex-col gap-2 border-t-2 border-gray-200 dark:border-gray-700 pt-3">
          <input
            key={`edit-title-${editingAnnouncementId}`}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            placeholder="Title"
            autoComplete="off"
          />
          <textarea
            key={`edit-body-${editingAnnouncementId}`}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 px-3 py-2 text-sm resize-none dark:bg-[#262626]"
            rows={3}
            placeholder="Body"
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#A8A8A8] cursor-pointer">
            <input
              type="checkbox"
              checked={editPinned}
              onChange={(e) => setEditPinned(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
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
              className="text-gray-500 dark:text-[#A8A8A8] text-sm px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 dark:text-[#A8A8A8]">
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
  const [linkedStudentId, setLinkedStudentId] = useState(null)
  const [studentGroupIds, setStudentGroupIds] = useState([])
  const isAdmin = userRole === 'admin'
  const isTeacher = userRole === 'teacher' || userRole === 'admin'
  const isParent = userRole === 'parent'

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [classGroups, setClassGroups] = useState([])
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
  const [teacherClassGroups, setTeacherClassGroups] = useState([])
  const [teacherTargetClassIds, setTeacherTargetClassIds] = useState([])
  const [teacherSelectedGroupId, setTeacherSelectedGroupId] = useState('')
  const [teacherAnnouncementTarget, setTeacherAnnouncementTarget] = useState('students')
  const [teacherSpecificStudentRoll, setTeacherSpecificStudentRoll] = useState('')
  const [teacherSpecificStudent, setTeacherSpecificStudent] = useState(null)
  const [studentSearchForAnnouncement, setStudentSearchForAnnouncement] = useState('')
  const [studentSearchResults, setStudentSearchResults] = useState([])
  const [selectedAnnouncementStudents, setSelectedAnnouncementStudents] = useState([])
  const [teacherAnnouncementTab, setTeacherAnnouncementTab] = useState('institute')

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role, name, institute_id, class_id, roll_number')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setUserRole(data.role)
          setUserName(data.name)
          setInstituteId(data.institute_id)
          if (data.role === 'student') {
            setStudentClassId(data.class_id)
            setLinkedStudentId(session.user.id)
          } else if (data.role === 'parent') {
            const linkedStudent = await fetchLinkedStudent(data)
            setStudentClassId(linkedStudent?.class_id ?? null)
            setLinkedStudentId(linkedStudent?.id ?? null)
          }
        }
      })
  }, [session])

  useEffect(() => {
    if (!studentClassId || (userRole !== 'student' && userRole !== 'parent')) {
      setStudentGroupIds([])
      return
    }

    async function loadStudentGroupIds() {
      const { data: groupMembers } = await supabase
        .from('class_group_members')
        .select('group_id')
        .eq('class_id', studentClassId)

      setStudentGroupIds((groupMembers ?? []).map((g) => g.group_id))
    }

    loadStudentGroupIds()
  }, [studentClassId, userRole])

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
          .from('class_groups')
          .select('id, name')
          .eq('institute_id', instituteId)
          .order('name'),
        supabase
          .from('users')
          .select('id, name')
          .eq('role', 'teacher')
          .eq('institute_id', instituteId)
          .order('name'),
      ]).then(([subjectsRes, classesRes, groupsRes, teachersRes]) => {
        if (subjectsRes.data) setSubjects(subjectsRes.data)
        if (classesRes.data) setClasses(classesRes.data)
        if (groupsRes.data) setClassGroups(groupsRes.data)
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

    async function loadTeacherClassesAndGroups() {
      const { data } = await supabase
        .from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', session.user.id)

      const seen = new Set()
      const unique = []
      const teacherClassIds = []
      for (const row of data ?? []) {
        if (row.classes && !seen.has(row.class_id)) {
          seen.add(row.class_id)
          unique.push(row.classes)
          teacherClassIds.push(row.class_id)
        }
      }
      setTeacherClasses(unique)

      if (!teacherClassIds.length) {
        setTeacherClassGroups([])
        return
      }

      const { data: members } = await supabase
        .from('class_group_members')
        .select('group_id')
        .in('class_id', teacherClassIds)

      const groupIds = [...new Set((members ?? []).map((m) => m.group_id))]
      if (!groupIds.length || !instituteId) {
        setTeacherClassGroups([])
        return
      }

      const { data: groups } = await supabase
        .from('class_groups')
        .select('id, name')
        .eq('institute_id', instituteId)
        .in('id', groupIds)
        .order('name')

      setTeacherClassGroups(groups ?? [])
    }

    loadTeacherClassesAndGroups()
  }, [userRole, session, instituteId])

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

    const groupIds = [
      ...new Set(
        rows
          .filter((a) => GROUP_TARGET_TYPES.includes(a.target_type))
          .flatMap((a) => a.target_ids ?? [])
      ),
    ]

    const groupNameMap = {}
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('id', groupIds)

      for (const g of groups ?? []) {
        groupNameMap[g.id] = g.name
      }
    }

    const enriched = rows.map((a) => {
      const groupNames = GROUP_TARGET_TYPES.includes(a.target_type)
        ? (a.target_ids ?? []).map((id) => groupNameMap[id]).filter(Boolean)
        : null

      return {
        ...a,
        users: creatorMap[a.created_by] ?? null,
        group_name: groupNames?.[0] ?? null,
        group_names: groupNames,
      }
    })

    setAnnouncements(enriched)
    setLoading(false)
  }, [session])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  const sendAnnouncementNotifications = useCallback(async ({ title, body, targetType, targetIds }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${import.meta.env.VITE_API_URL}/send-announcement-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        institute_id: instituteId,
        title,
        body,
        target_type: targetType,
        target_ids: targetIds,
      }),
    })
  }, [instituteId])

  async function handlePost(e) {
    e.preventDefault()
    if (!newTitle.trim() || !session?.user?.id || !instituteId) return

    const needsTargets = [
      'class_students',
      'class_teachers',
      'specific_class',
      'subject_teachers',
      'specific_teacher',
      'specific_student',
      ...GROUP_TARGET_TYPES,
    ].includes(targetType)

    if (isAdmin && needsTargets && targetIds.length === 0) {
      setError('Please select at least one target.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'class_students' && teacherTargetClassIds.length === 0) {
      setError('Please select at least one class.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'specific_class' && teacherTargetClassIds.length === 0) {
      setError('Please select at least one class.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'specific_student' && !teacherSpecificStudent) {
      setError('Please find a student by roll number.')
      return
    }

    if (userRole === 'teacher' && teacherAnnouncementTarget === 'group' && !teacherSelectedGroupId) {
      setError('Please select a group.')
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
      } else if (teacherAnnouncementTarget === 'specific_class') {
        finalTargetType = 'specific_class'
        finalTargetIds = teacherTargetClassIds
      } else if (teacherAnnouncementTarget === 'specific_student') {
        finalTargetType = 'specific_student'
        finalTargetIds = teacherSpecificStudent ? [teacherSpecificStudent.id] : []
      } else if (teacherAnnouncementTarget === 'group') {
        finalTargetType = 'group_students'
        finalTargetIds = teacherSelectedGroupId ? [teacherSelectedGroupId] : []
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
      await sendAnnouncementNotifications({
        title: insertPayload.title,
        body: insertPayload.body,
        targetType: insertPayload.target_type,
        targetIds: insertPayload.target_ids,
      })

      setNewTitle('')
      setNewBody('')
      setIsPinned(false)
      setTargetType('everyone')
      setTargetIds([])
      setTargetSubjectIds([])
      setTeacherTargetClassIds([])
      setTeacherSelectedGroupId('')
      setTeacherAnnouncementTarget('students')
      setTeacherSpecificStudentRoll('')
      setTeacherSpecificStudent(null)
      setStudentSearchForAnnouncement('')
      setStudentSearchResults([])
      setSelectedAnnouncementStudents([])
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
      : userRole === 'student' || userRole === 'parent'
        ? announcements.filter((a) =>
            studentCanSeeAnnouncement(
              a,
              studentClassId,
              linkedStudentId ?? session?.user?.id,
              studentGroupIds
            )
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">Announcements</h1>
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Welcome, {userName}</p>
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
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
            }`}
          >
            📢 From Institute
          </button>
          <button
            type="button"
            onClick={() => setTeacherAnnouncementTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-shadow hover:shadow-md ${
              teacherAnnouncementTab === 'mine'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8]'
            }`}
          >
            📝 My Announcements
          </button>
        </div>
      )}

      {(userRole !== 'teacher' || teacherAnnouncementTab === 'mine') && isTeacher && showForm && (
        <form
          onSubmit={handlePost}
          className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-sm flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Post Announcement</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              placeholder="Announcement title"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Body</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none resize-none"
              placeholder="Write your announcement…"
            />
          </div>

          {userRole === 'teacher' && teacherClasses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                Send To
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('students')
                    setTeacherTargetClassIds([])
                    setTeacherSelectedGroupId('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'students'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  My Students
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('class_students')
                    setTeacherSelectedGroupId('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'class_students'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  Specific Class Students
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('specific_class')
                    setTeacherSelectedGroupId('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'specific_class'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  Specific Class (Students + Teachers)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('group')
                    setTeacherTargetClassIds([])
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'group'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  Send to Group
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAnnouncementTarget('specific_student')
                    setTeacherSelectedGroupId('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    teacherAnnouncementTarget === 'specific_student'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                  }`}
                >
                  👤 Specific Student
                </button>
              </div>

              {teacherAnnouncementTarget === 'group' && (
                <div>
                  {teacherClassGroups.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                      No groups found for your assigned classes.
                    </p>
                  ) : (
                    <select
                      value={teacherSelectedGroupId}
                      onChange={(e) => setTeacherSelectedGroupId(e.target.value)}
                      className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">Select group...</option>
                      {teacherClassGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {(teacherAnnouncementTarget === 'class_students' || teacherAnnouncementTarget === 'specific_class') && (
                <div className="flex flex-wrap gap-2">
                  {teacherClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        teacherTargetClassIds.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
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
                    className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                Send To
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { value: 'everyone', label: '🌐 Everyone' },
                  { value: 'all_teachers', label: '👩‍🏫 All Teachers' },
                  { value: 'all_students', label: '👨‍🎓 All Students' },
                  { value: 'class_students', label: '📚 Specific Classes (Students)' },
                  { value: 'class_teachers', label: '🏫 Class Teachers' },
                  { value: 'specific_class', label: '🏫 Specific Class (Students + Teachers)' },
                  { value: 'subject_teachers', label: '📖 Subject Teachers' },
                  { value: 'group_students', label: '👥 Group Students' },
                  { value: 'group_teachers', label: '👨‍🏫 Group Teachers' },
                  { value: 'entire_group', label: '🏫 Entire Group' },
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
                      setStudentSearchResults([])
                      setSelectedAnnouncementStudents([])
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      targetType === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-[#1C1C1C] text-gray-600 dark:text-[#A8A8A8] border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(targetType === 'class_students' || targetType === 'class_teachers' || targetType === 'specific_class') && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <p className="w-full text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Select classes:</p>
                  {classes.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(c.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white dark:bg-[#1C1C1C] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
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
                  <p className="w-full text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Select subjects:</p>
                  {subjects.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(s.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white dark:bg-[#1C1C1C] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
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

              {(targetType === 'group_students' || targetType === 'group_teachers' || targetType === 'entire_group') && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <p className="w-full text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Select groups:</p>
                  {classGroups.map((g) => (
                    <label
                      key={g.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(g.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white dark:bg-[#1C1C1C] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetIds.includes(g.id)}
                        onChange={() =>
                          setTargetIds((prev) =>
                            prev.includes(g.id)
                              ? prev.filter((id) => id !== g.id)
                              : [...prev, g.id]
                          )
                        }
                        className="hidden"
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              )}

              {targetType === 'specific_teacher' && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <p className="w-full text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">Select teachers:</p>
                  {teachers.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        targetIds.includes(t.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white dark:bg-[#1C1C1C] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetIds.includes(t.id)}
                        onChange={() =>
                          setTargetIds((prev) =>
                            prev.includes(t.id)
                              ? prev.filter((id) => id !== t.id)
                              : [...prev, t.id]
                          )
                        }
                        className="hidden"
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              )}

              {targetType === 'specific_student' && (
                <div>
                  {selectedAnnouncementStudents.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedAnnouncementStudents.map((student) => (
                        <span
                          key={student.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200"
                        >
                          {student.name} (Roll #{student.roll_number})
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAnnouncementStudents((prev) =>
                                prev.filter((s) => s.id !== student.id)
                              )
                              setTargetIds((prev) => prev.filter((id) => id !== student.id))
                            }}
                            className="text-blue-500 hover:text-blue-800 font-bold leading-none"
                            aria-label={`Remove ${student.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={studentSearchForAnnouncement}
                    onChange={async (e) => {
                      const query = e.target.value
                      setStudentSearchForAnnouncement(query)
                      const trimmed = query.trim()
                      if (trimmed.length < 1) {
                        setStudentSearchResults([])
                        return
                      }
                      const { data } = await supabase
                        .from('users')
                        .select('id, name, roll_number')
                        .eq('role', 'student')
                        .eq('institute_id', instituteId)
                        .or(`name.ilike.%${trimmed}%,roll_number.ilike.%${trimmed}%`)
                        .order('name')
                        .limit(20)
                      setStudentSearchResults(data ?? [])
                    }}
                    placeholder="Search students by name or roll number..."
                    className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                  />
                  {studentSearchResults.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {studentSearchResults.map((student) => (
                        <label
                          key={student.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                            targetIds.includes(student.id)
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'bg-white dark:bg-[#1C1C1C] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={targetIds.includes(student.id)}
                            onChange={() => {
                              if (targetIds.includes(student.id)) {
                                setTargetIds((prev) => prev.filter((id) => id !== student.id))
                                setSelectedAnnouncementStudents((prev) =>
                                  prev.filter((s) => s.id !== student.id)
                                )
                              } else {
                                setTargetIds((prev) => [...prev, student.id])
                                setSelectedAnnouncementStudents((prev) => [...prev, student])
                              }
                            }}
                            className="hidden"
                          />
                          {student.name} (Roll #{student.roll_number})
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#A8A8A8]">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
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
        <div className="flex justify-center items-center h-64">
          <Loader size={40} />
        </div>
      )}

      {!loading && displayedAnnouncements.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No announcements yet.</p>
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
