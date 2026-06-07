import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Announcements() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('student')
  const [userName, setUserName] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [studentClassId, setStudentClassId] = useState(null)
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newSubjectId, setNewSubjectId] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

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
      supabase
        .from('subjects')
        .select('id, name')
        .eq('institute_id', instituteId)
        .order('name')
        .then(({ data }) => {
          if (data) setSubjects(data)
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

  const loadAnnouncements = useCallback(async () => {
    if (!session?.user?.id || !instituteId) return

    setLoading(true)

    const selectFields =
      'id, title, body, is_pinned, created_at, class_id, subject_id, subjects(name), classes(name), created_by, users(name, role)'

    if (isTeacher) {
      const { data } = await supabase
        .from('announcements')
        .select(selectFields)
        .eq('institute_id', instituteId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      setAnnouncements(data ?? [])
    } else if (userRole === 'student') {
      let query = supabase
        .from('announcements')
        .select(selectFields)
        .eq('institute_id', instituteId)

      if (studentClassId) {
        query = query.or(`class_id.is.null,class_id.eq.${studentClassId}`)
      } else {
        query = query.is('class_id', null)
      }

      const { data } = await query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      setAnnouncements(data ?? [])
    }

    setLoading(false)
  }, [session, isTeacher, userRole, studentClassId, instituteId])

  useEffect(() => {
    if (!session?.user?.id || !instituteId) return
    loadAnnouncements()
  }, [session, isTeacher, userRole, studentClassId, instituteId, loadAnnouncements])

  async function handlePost(e) {
    e.preventDefault()
    if (!newTitle.trim() || !session?.user?.id || !instituteId) return

    setSaving(true)
    const { error } = await supabase.from('announcements').insert({
      title: newTitle,
      body: newBody,
      subject_id: newSubjectId || null,
      is_pinned: isPinned,
      created_by: session.user.id,
      institute_id: instituteId,
    })

    if (!error) {
      setNewTitle('')
      setNewBody('')
      setNewSubjectId('')
      setIsPinned(false)
      setShowForm(false)
      await loadAnnouncements()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    await supabase.from('announcements').delete().eq('id', id)
    await loadAnnouncements()
  }

  const pinned = announcements.filter((a) => a.is_pinned)
  const regular = announcements.filter((a) => !a.is_pinned)

  function AnnouncementCard({ item }) {
    const pinnedCard = item.is_pinned
    return (
      <div
        className={`rounded-2xl border border-gray-200 p-5 shadow-sm ${
          pinnedCard ? 'bg-yellow-50' : 'bg-white'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            {pinnedCard && (
              <span className="text-xs text-yellow-600 font-medium">📌 Pinned</span>
            )}
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.body}</p>
          </div>
          {(userRole === 'admin' ||
            (userRole === 'teacher' && item.created_by === session.user.id)) && (
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              Delete
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
          <span>By {item.users?.name}</span>
          {item.subjects?.name && <span>· {item.subjects.name}</span>}
          <span>· {item.classes?.name ?? 'Institute-wide'}</span>
          <span>· {new Date(item.created_at).toLocaleDateString()}</span>
        </div>
      </div>
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
        {isTeacher && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Create Announcement'}
          </button>
        )}
      </div>

      {isTeacher && showForm && (
        <form
          onSubmit={handlePost}
          className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">Post Announcement</h2>

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

          <div>
            <label className="block text-sm text-gray-600 mb-1">Subject</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Institute-wide</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

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

      {!loading && announcements.length === 0 && (
        <p className="text-sm text-gray-500">No announcements yet.</p>
      )}

      {!loading && pinned.length > 0 && (
        <div className="flex flex-col gap-3">
          {pinned.map((item) => (
            <AnnouncementCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!loading && regular.length > 0 && (
        <div className="flex flex-col gap-3">
          {regular.map((item) => (
            <AnnouncementCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
