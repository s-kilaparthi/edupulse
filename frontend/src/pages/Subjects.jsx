import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [subjectName, setSubjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandedSubjectId, setExpandedSubjectId] = useState(null)
  const [topicInput, setTopicInput] = useState('')
  const [topicSaving, setTopicSaving] = useState(false)

  async function fetchSubjects() {
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'Not authenticated')
      setSubjects([])
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('subjects')
      .select('id, name, topics(id, name)')
      .eq('teacher_id', user.id)
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
      setSubjects([])
    } else {
      setSubjects(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSubjects()
  }, [])

  async function handleCreateSubject(e) {
    e.preventDefault()
    const name = subjectName.trim()
    if (!name) return

    setSaving(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'Not authenticated')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('subjects').insert({
      name,
      institute_id: null,
      teacher_id: user.id,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSubjectName('')
    setLoading(true)
    await fetchSubjects()
  }

  function toggleTopics(subjectId) {
    setExpandedSubjectId((prev) => (prev === subjectId ? null : subjectId))
    setTopicInput('')
  }

  async function handleAddTopic(subjectId) {
    const name = topicInput.trim()
    if (!name) return

    setTopicSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('topics').insert({
      name,
      subject_id: subjectId,
    })

    setTopicSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setTopicInput('')
    setLoading(true)
    await fetchSubjects()
    setExpandedSubjectId(subjectId)
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subjects</h1>

      <form
        onSubmit={handleCreateSubject}
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Create Subject</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="Subject name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading subjects…</p>
      ) : subjects.length === 0 ? (
        <p className="text-gray-500 text-sm">No subjects yet. Create one above.</p>
      ) : (
        <ul className="space-y-3">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="font-medium text-gray-900">{subject.name}</span>
                <button
                  type="button"
                  onClick={() => toggleTopics(subject.id)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                >
                  {expandedSubjectId === subject.id ? 'Hide Topics' : 'Add Topics'}
                </button>
              </div>

              {subject.topics?.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {subject.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                    >
                      {topic.name}
                    </li>
                  ))}
                </ul>
              )}

              {expandedSubjectId === subject.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
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
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTopic(subject.id)}
                    disabled={topicSaving}
                    className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {topicSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
