import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D']

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString()
}

function buildEmptyQuestions(count) {
  return Array.from({ length: count }, (_, i) => ({
    question_number: i + 1,
    correct_answer: '',
    topic_id: '',
  }))
}

export default function Exams() {
  const [subjects, setSubjects] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingExam, setSavingExam] = useState(false)
  const [savingQuestions, setSavingQuestions] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [examName, setExamName] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [totalQuestions, setTotalQuestions] = useState('')

  const [activeExam, setActiveExam] = useState(null)
  const [topics, setTopics] = useState([])
  const [questionRows, setQuestionRows] = useState([])

  async function getAuthUser() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error(userError?.message ?? 'Not authenticated')
    }
    return user
  }

  async function fetchSubjects() {
    const user = await getAuthUser()
    const { data, error: fetchError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('name')

    if (fetchError) throw new Error(fetchError.message)
    setSubjects(data ?? [])
  }

  async function fetchExams() {
    const { data, error: fetchError } = await supabase
      .from('exams')
      .select('id, name, exam_date, total_questions, subject_id, subjects(name)')
      .order('exam_date', { ascending: false })

    if (fetchError) throw new Error(fetchError.message)
    setExams(data ?? [])
  }

  function formatSupabaseError(insertError) {
    return [insertError.message, insertError.details, insertError.hint]
      .filter(Boolean)
      .join(' — ')
  }

  async function loadPageData() {
    setError(null)
    setSuccessMessage(null)
    setLoading(true)
    try {
      await Promise.all([fetchSubjects(), fetchExams()])
    } catch (err) {
      setError(err.message)
      setSubjects([])
      setExams([])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPageData()
  }, [])

  async function handleCreateExam(e) {
    e.preventDefault()
    const name = examName.trim()
    const total = parseInt(totalQuestions, 10)

    if (!name || !subjectId || !examDate || !total || total < 1) {
      setError('Please fill in all exam fields with a valid question count.')
      return
    }

    setSavingExam(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const user = await getAuthUser()
      const { error: insertError } = await supabase.from('exams').insert({
        name,
        subject_id: subjectId,
        exam_date: examDate,
        total_questions: total,
        created_by: user.id,
      })

      if (insertError) throw new Error(insertError.message)

      setExamName('')
      setSubjectId('')
      setExamDate('')
      setTotalQuestions('')
      await fetchExams()
    } catch (err) {
      setError(err.message)
    }

    setSavingExam(false)
  }

  async function openQuestionsPanel(exam) {
    setError(null)
    setSuccessMessage(null)
    setActiveExam(exam)
    setQuestionRows(buildEmptyQuestions(exam.total_questions))

    const { data, error: fetchError } = await supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', exam.subject_id)
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
      setTopics([])
    } else {
      setTopics(data ?? [])
    }
  }

  function closeQuestionsPanel() {
    setActiveExam(null)
    setTopics([])
    setQuestionRows([])
  }

  function updateQuestionRow(index, field, value) {
    setQuestionRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  async function handleSaveAllQuestions() {
    if (!activeExam) return

    const incomplete = questionRows.some(
      (row) => !row.correct_answer || !row.topic_id
    )
    if (incomplete) {
      setError('Please set a correct answer and topic for every question.')
      setSuccessMessage(null)
      return
    }

    setSavingQuestions(true)
    setError(null)
    setSuccessMessage(null)

    const payload = questionRows.map((row) => ({
      exam_id: activeExam.id,
      question_number: Number(row.question_number),
      topic_id: row.topic_id,
      correct_answer: row.correct_answer,
    }))

    console.log('Questions insert payload:', payload)

    const { data, error: insertError } = await supabase
      .from('questions')
      .insert(payload)
      .select()

    if (insertError) {
      console.error('Questions insert error:', insertError)
      const message = formatSupabaseError(insertError)
      setError(message)
      setSavingQuestions(false)
      return
    }

    console.log('Questions insert success:', data)
    setSuccessMessage(
      `Saved ${data?.length ?? payload.length} questions for ${activeExam.name}.`
    )
    closeQuestionsPanel()
    setSavingQuestions(false)
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Exams</h1>

      <form
        onSubmit={handleCreateExam}
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Create Exam</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="exam-name" className="block text-sm font-medium text-gray-700 mb-1">
              Exam name
            </label>
            <input
              id="exam-name"
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="Mid-term Physics"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="exam-subject" className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select
              id="exam-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exam-date" className="block text-sm font-medium text-gray-700 mb-1">
              Exam date
            </label>
            <input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="total-questions" className="block text-sm font-medium text-gray-700 mb-1">
              Total questions
            </label>
            <input
              id="total-questions"
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value)}
              placeholder="30"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingExam}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {savingExam ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">All Exams</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading exams…</p>
        ) : exams.length === 0 ? (
          <p className="text-gray-500 text-sm">No exams yet. Create one above.</p>
        ) : (
          <ul className="space-y-3">
            {exams.map((exam) => (
              <li
                key={exam.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{exam.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {exam.subjects?.name ?? 'Unknown subject'} · {formatDate(exam.exam_date)} ·{' '}
                      {exam.total_questions} questions
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuestionsPanel(exam)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  >
                    Add Questions
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeExam && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Add Questions — {activeExam.name}
            </h2>
            <button
              type="button"
              onClick={closeQuestionsPanel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          {topics.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">
              No topics for this subject yet. Add topics on the Subjects page first.
            </p>
          ) : null}

          <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
            {questionRows.map((row, index) => (
              <div
                key={row.question_number}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center border-b border-gray-100 pb-3 last:border-0"
              >
                <span className="text-sm font-medium text-gray-700">
                  Question {row.question_number}
                </span>
                <select
                  value={row.correct_answer}
                  onChange={(e) => updateQuestionRow(index, 'correct_answer', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Correct answer</option>
                  {ANSWER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <select
                  value={row.topic_id}
                  onChange={(e) => updateQuestionRow(index, 'topic_id', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select topic</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {error && activeExam && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveAllQuestions}
            disabled={savingQuestions || topics.length === 0}
            className="bg-gray-900 text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {savingQuestions ? 'Saving…' : 'Save All Questions'}
          </button>
        </section>
      )}
    </>
  )
}
