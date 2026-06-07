import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D']

const TOPIC_COLORS = [
  'bg-blue-200 text-blue-800 border-blue-400',
  'bg-purple-200 text-purple-800 border-purple-400',
  'bg-orange-200 text-orange-800 border-orange-400',
  'bg-pink-200 text-pink-800 border-pink-400',
  'bg-teal-200 text-teal-800 border-teal-400',
  'bg-yellow-200 text-yellow-800 border-yellow-400',
  'bg-indigo-200 text-indigo-800 border-indigo-400',
  'bg-red-200 text-red-800 border-red-400',
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString()
}

export default function Exams() {
  const [subjects, setSubjects] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingExam, setSavingExam] = useState(false)
  const [savingQuestions, setSavingQuestions] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Create exam form
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [totalQuestions, setTotalQuestions] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [scope, setScope] = useState('class')
  const [selectedClassIds, setSelectedClassIds] = useState([])
  const [classes, setClasses] = useState([])
  const [teacherClassIds, setTeacherClassIds] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [instituteId, setInstituteId] = useState(null)

  // Add questions panel
  const [activeExam, setActiveExam] = useState(null)
  const [examSubjects, setExamSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [activeSubjectId, setActiveSubjectId] = useState('')
  const [activeTopicId, setActiveTopicId] = useState('')
  const [selectedQNums, setSelectedQNums] = useState([])
  const [questionMap, setQuestionMap] = useState({})

  const questionsPanelRef = useRef(null)

  async function getAuthUser() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error(userError?.message ?? 'Not authenticated')
    return user
  }

  async function fetchSubjects() {
    const user = await getAuthUser()
    let query = supabase
      .from('subjects')
      .select('id, name')
      .order('name')

    if (userRole === 'admin') {
      query = query.eq('institute_id', instituteId)
    } else {
      query = query.eq('teacher_id', user.id)
    }

    const { data, error: fetchError } = await query
    if (fetchError) throw new Error(fetchError.message)
    setSubjects(data ?? [])
  }

  async function fetchExams() {
    const { data, error: fetchError } = await supabase
      .from('exams')
      .select('id, name, exam_date, total_questions, scope, exam_subjects(subject_id, question_from, question_to, subjects(name)), exam_classes(class_id, classes(name))')
      .order('exam_date', { ascending: false })
    if (fetchError) throw new Error(fetchError.message)
    setExams(data ?? [])
  }

  async function loadPageData() {
    setError(null)
    setLoading(true)
    try {
      const user = await getAuthUser()
      const { data: userData } = await supabase
        .from('users')
        .select('role, institute_id')
        .eq('id', user.id)
        .single()

      const role = userData?.role ?? 'teacher'
      const instId = userData?.institute_id ?? null
      setUserRole(role)
      setInstituteId(instId)

      if (instId) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', instId)
          .order('name')
        if (classData) setClasses(classData)
      }

      if (role === 'teacher') {
        const { data: tcData } = await supabase
          .from('class_teachers')
          .select('class_id, classes(id, name)')
          .eq('teacher_id', user.id)

        setTeacherClassIds(tcData?.map((tc) => tc.class_id) ?? [])
      } else {
        setTeacherClassIds([])
      }

      await fetchExams()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => { loadPageData() }, [])

  useEffect(() => {
    if (!userRole) return
    if (userRole === 'admin' && !instituteId) return

    fetchSubjects().catch((err) => setError(err.message))
  }, [userRole, instituteId])

  function toggleSubject(subject) {
    setSelectedSubjects((prev) => {
      const exists = prev.find((s) => s.subject_id === subject.id)
      if (exists) return prev.filter((s) => s.subject_id !== subject.id)
      return [...prev, { subject_id: subject.id, name: subject.name, question_from: '', question_to: '' }]
    })
  }

  function updateSubjectRange(subject_id, field, value) {
    setSelectedSubjects((prev) =>
      prev.map((s) => s.subject_id === subject_id ? { ...s, [field]: value } : s)
    )
  }

  async function handleCreateExam(e) {
    e.preventDefault()
    const name = examName.trim()
    const total = parseInt(totalQuestions, 10)

    if (!name || !examDate || !total || total < 1) {
      setError('Please fill in all exam fields.')
      return
    }
    const examScope = userRole === 'teacher' ? 'class' : scope

    if ((examScope === 'class' || examScope === 'multiple') && selectedClassIds.length === 0) {
      setError('Please select at least one class.')
      return
    }
    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject.')
      return
    }
    for (const s of selectedSubjects) {
      const from = parseInt(s.question_from, 10)
      const to = parseInt(s.question_to, 10)
      if (!from || !to || from < 1 || to < from || to > total) {
        setError(`Invalid question range for ${s.name}. Must be between 1 and ${total}, start <= end.`)
        return
      }
    }

    setSavingExam(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const user = await getAuthUser()
      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({ name, exam_date: examDate, total_questions: total, created_by: user.id, scope: examScope })
        .select('id')
        .single()
      if (examErr) throw new Error(examErr.message)

      const examSubjectRows = selectedSubjects.map((s) => ({
        exam_id: newExam.id,
        subject_id: s.subject_id,
        question_from: parseInt(s.question_from, 10),
        question_to: parseInt(s.question_to, 10),
      }))
      const { error: esError } = await supabase.from('exam_subjects').insert(examSubjectRows)
      if (esError) throw new Error(esError.message)

      if (examScope !== 'institute') {
        const examClassRows = selectedClassIds.map((classId) => ({
          exam_id: newExam.id,
          class_id: classId,
        }))
        const { error: ecError } = await supabase.from('exam_classes').insert(examClassRows)
        if (ecError) throw new Error(ecError.message)
      }

      setExamName('')
      setExamDate('')
      setTotalQuestions('')
      setSelectedSubjects([])
      setScope('class')
      setSelectedClassIds([])
      setSuccessMessage(`Exam "${name}" created successfully.`)
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
    setActiveSubjectId('')
    setActiveTopicId('')
    setSelectedQNums([])
    setQuestionMap({})
    const es = exam.exam_subjects ?? []
    setExamSubjects(es)
    const subjectIds = es.map((s) => s.subject_id)
    if (subjectIds.length === 0) { setTopics([]); return }
    const { data, error: fetchError } = await supabase
      .from('topics')
      .select('id, name, subject_id, subjects(name)')
      .in('subject_id', subjectIds)
      .order('name')
    if (fetchError) { setError(fetchError.message); setTopics([]) }
    else setTopics(data ?? [])

    // Pre-populate questionMap with existing saved questions
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('question_number, topic_id, correct_answer, topics(name)')
      .eq('exam_id', exam.id)

    if (existingQuestions && existingQuestions.length > 0) {
      const allTopicIds = (data ?? []).map((t) => t.id)
      const map = {}
      existingQuestions.forEach((q) => {
        const idx = allTopicIds.indexOf(q.topic_id)
        const color = TOPIC_COLORS[idx % TOPIC_COLORS.length]
        map[q.question_number] = {
          topic_id: q.topic_id,
          topic_name: q.topics?.name ?? '',
          color,
          correct_answer: q.correct_answer,
        }
      })
      setQuestionMap(map)
    }

    setTimeout(() => {
      questionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function closeQuestionsPanel() {
    setActiveExam(null)
    setExamSubjects([])
    setTopics([])
    setActiveSubjectId('')
    setActiveTopicId('')
    setSelectedQNums([])
    setQuestionMap({})
  }

  function getActiveSubjectRange() {
    const es = examSubjects.find((s) => s.subject_id === activeSubjectId)
    if (!es) return []
    const nums = []
    for (let i = es.question_from; i <= es.question_to; i++) nums.push(i)
    return nums
  }

  function toggleQNum(num) {
    setSelectedQNums((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    )
  }

  function getTopicColor(topic_id) {
    const allTopicIds = topics.map((t) => t.id)
    const idx = allTopicIds.indexOf(topic_id)
    return TOPIC_COLORS[idx % TOPIC_COLORS.length]
  }

  function assignTopicToSelected() {
    if (!activeTopicId || selectedQNums.length === 0) return
    const topic = topics.find((t) => t.id === activeTopicId)
    const color = getTopicColor(activeTopicId)
    setQuestionMap((prev) => {
      const next = { ...prev }
      selectedQNums.forEach((num) => {
        next[num] = {
          ...next[num],
          topic_id: activeTopicId,
          topic_name: topic?.name ?? '',
          color,
          correct_answer: next[num]?.correct_answer ?? '',
        }
      })
      return next
    })
    setSelectedQNums([])
  }

  function updateAnswer(qNum, answer) {
    setQuestionMap((prev) => ({
      ...prev,
      [qNum]: { ...prev[qNum], correct_answer: answer },
    }))
  }

  function getAllQuestionNums() {
    const nums = []
    examSubjects.forEach((es) => {
      for (let i = es.question_from; i <= es.question_to; i++) nums.push(i)
    })
    return nums.sort((a, b) => a - b)
  }

  function getUnassignedCount() {
    return getAllQuestionNums().filter((n) => !questionMap[n]?.topic_id).length
  }

  function getMissingAnswerCount() {
    return getAllQuestionNums().filter((n) => !questionMap[n]?.correct_answer).length
  }

  async function handleSaveAllQuestions() {
    if (!activeExam) return

    const allNums = getAllQuestionNums()
    const unassigned = allNums.filter((n) => !questionMap[n]?.topic_id)
    if (unassigned.length > 0) {
      setError(`${unassigned.length} question(s) still have no topic: Q${unassigned.join(', Q')}`)
      return
    }
    const noAnswer = allNums.filter((n) => !questionMap[n]?.correct_answer)
    if (noAnswer.length > 0) {
      setError(`${noAnswer.length} question(s) still have no answer: Q${noAnswer.join(', Q')}`)
      return
    }

    setSavingQuestions(true)
    setError(null)

    const payload = allNums.map((num) => ({
      exam_id: activeExam.id,
      question_number: num,
      topic_id: questionMap[num].topic_id,
      correct_answer: questionMap[num].correct_answer,
    }))

    const { data, error: insertError } = await supabase
      .from('questions')
      .upsert(payload, { onConflict: 'exam_id,question_number' })
      .select()

    if (insertError) {
      setError([insertError.message, insertError.details, insertError.hint].filter(Boolean).join(' — '))
      setSavingQuestions(false)
      return
    }

    setSuccessMessage(`Saved ${data?.length ?? payload.length} questions for "${activeExam.name}".`)
    closeQuestionsPanel()
    setSavingQuestions(false)
  }

  const activeSubjectTopics = topics.filter((t) => t.subject_id === activeSubjectId)
  const gridNums = getActiveSubjectRange()
  const allNums = activeExam ? getAllQuestionNums() : []
  const unassignedCount = activeExam ? getUnassignedCount() : 0
  const missingAnswerCount = activeExam ? getMissingAnswerCount() : 0
  const availableClasses =
    userRole === 'admin'
      ? classes
      : classes.filter((c) => teacherClassIds.includes(c.id))

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam name</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="JEE Mains Mock Test 1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {userRole === 'admin' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam Scope
              </label>
              <div className="flex gap-3">
                {['class', 'multiple', 'institute'].map((s) => (
                  <label
                    key={s}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      scope === s
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={s}
                      checked={scope === s}
                      onChange={() => { setScope(s); setSelectedClassIds([]) }}
                      className="hidden"
                    />
                    {s === 'class' ? 'Single Class' : s === 'multiple' ? 'Multiple Classes' : 'Whole Institute'}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(userRole === 'teacher' || scope === 'class' || scope === 'multiple') && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userRole === 'teacher'
                  ? 'Select Class'
                  : `Select Class${scope === 'multiple' ? 'es' : ''}`}
              </label>
              <div className="flex flex-wrap gap-2">
                {availableClasses.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      selectedClassIds.includes(c.id)
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => setSelectedClassIds((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((id) => id !== c.id)
                          : userRole === 'teacher' || scope === 'class'
                            ? [c.id]
                            : [...prev, c.id]
                      )}
                      className="hidden"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              {availableClasses.length === 0 && (
                <p className="text-xs text-gray-400">
                  {userRole === 'teacher'
                    ? 'No assigned classes found.'
                    : 'No classes found. Create classes first.'}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Subjects & Question Ranges</label>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-400">No subjects found. Add subjects on the Subjects page first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => {
                  const selected = selectedSubjects.find((ss) => ss.subject_id === s.id)
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-3">
                      <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}>
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleSubject(s)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                        {s.name}
                      </label>
                      {selected && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Q from</span>
                          <input
                            type="number"
                            min={1}
                            value={selected.question_from}
                            onChange={(e) => updateSubjectRange(s.id, 'question_from', e.target.value)}
                            placeholder="1"
                            className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-xs text-gray-500">to</span>
                          <input
                            type="number"
                            min={1}
                            value={selected.question_to}
                            onChange={(e) => updateSubjectRange(s.id, 'question_to', e.target.value)}
                            placeholder="30"
                            className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam date</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total questions</label>
            <input
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value)}
              placeholder="90"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingExam}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {savingExam ? 'Saving…' : 'Save Exam'}
            </button>
          </div>
        </div>
      </form>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}
      {error && !activeExam && (
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
              <li key={exam.id}>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{exam.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {exam.exam_subjects?.map((es) => {
                          const name = es.subjects?.name
                          const range = es.question_from && es.question_to
                            ? ` (Q${es.question_from}–Q${es.question_to})`
                            : ''
                          return name ? name + range : null
                        }).filter(Boolean).join(', ') || 'No subjects'}{' '}
                        · {formatDate(exam.exam_date)} · {exam.total_questions} questions
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exam.scope === 'institute' ? 'Whole Institute' :
                          exam.exam_classes?.map((ec) => ec.classes?.name).filter(Boolean).join(', ') || 'No class'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => activeExam?.id === exam.id ? closeQuestionsPanel() : openQuestionsPanel(exam)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      {activeExam?.id === exam.id ? 'Close' : 'Add Questions'}
                    </button>
                  </div>
                </div>

                {activeExam?.id === exam.id && (
                  <div
                    ref={questionsPanelRef}
                    className="mt-2 bg-white rounded-xl border border-blue-200 p-6 shadow-sm"
                  >
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">
                      Add Questions — {activeExam.name}
                    </h2>

                    {examSubjects.length === 0 && (
                      <p className="text-sm text-gray-500">No subjects linked to this exam.</p>
                    )}

                    {examSubjects.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-3 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                            <select
                              value={activeSubjectId}
                              onChange={(e) => { setActiveSubjectId(e.target.value); setActiveTopicId(''); setSelectedQNums([]) }}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="">Select subject</option>
                              {examSubjects.map((es) => (
                                <option key={es.subject_id} value={es.subject_id}>
                                  {es.subjects?.name} (Q{es.question_from}–Q{es.question_to})
                                </option>
                              ))}
                            </select>
                          </div>

                          {activeSubjectId && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                              <select
                                value={activeTopicId}
                                onChange={(e) => { setActiveTopicId(e.target.value); setSelectedQNums([]) }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                              >
                                <option value="">Select topic</option>
                                {activeSubjectTopics.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {activeSubjectId && (
                          <>
                            <p className="text-xs text-gray-500 mb-2">
                              Tap question numbers to select, then click Assign.
                              {selectedQNums.length > 0 && (
                                <span className="ml-2 text-blue-600 font-medium">{selectedQNums.length} selected</span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {gridNums.map((num) => {
                                const assigned = questionMap[num]
                                const isSelected = selectedQNums.includes(num)
                                return (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => toggleQNum(num)}
                                    className={`w-10 h-10 rounded-lg border-2 text-xs font-medium transition-all ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-600 text-white scale-110'
                                        : assigned?.topic_id
                                        ? `${assigned.color} border-current`
                                        : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400'
                                    }`}
                                    title={assigned?.topic_name ?? 'Unassigned'}
                                  >
                                    {num}
                                  </button>
                                )
                              })}
                            </div>

                            {activeSubjectTopics.some((t) =>
                              Object.values(questionMap).some((q) => q.topic_id === t.id)
                            ) && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {activeSubjectTopics.map((t) => {
                                  const count = gridNums.filter((n) => questionMap[n]?.topic_id === t.id).length
                                  if (count === 0) return null
                                  return (
                                    <span key={t.id} className={`text-xs px-2 py-1 rounded-full border ${getTopicColor(t.id)}`}>
                                      {t.name} ({count})
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={assignTopicToSelected}
                              disabled={!activeTopicId || selectedQNums.length === 0}
                              className="mb-4 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Assign {selectedQNums.length > 0 ? `${selectedQNums.length} questions` : 'selected'} to topic
                            </button>
                          </>
                        )}

                        {allNums.length > 0 && (
                          <div className="border-t border-gray-100 pt-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-medium text-gray-700">Correct Answers</p>
                              <div className="flex gap-3 text-xs">
                                {unassignedCount > 0 && (
                                  <span className="text-orange-600">{unassignedCount} unassigned</span>
                                )}
                                {missingAnswerCount > 0 && (
                                  <span className="text-red-600">{missingAnswerCount} no answer</span>
                                )}
                                {unassignedCount === 0 && missingAnswerCount === 0 && (
                                  <span className="text-green-600">All complete ✓</span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                              {allNums.map((num) => {
                                const q = questionMap[num]
                                return (
                                  <div
                                    key={num}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                                      !q?.topic_id ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
                                    }`}
                                  >
                                    <span className="text-xs font-medium text-gray-500 w-6 shrink-0">Q{num}</span>
                                    <select
                                      value={q?.correct_answer ?? ''}
                                      onChange={(e) => updateAnswer(num, e.target.value)}
                                      className="flex-1 rounded border border-gray-300 px-1 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                    >
                                      <option value="">—</option>
                                      {ANSWER_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {error && activeExam && (
                          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                            <p className="text-red-700 text-sm">{error}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleSaveAllQuestions}
                          disabled={savingQuestions || unassignedCount > 0 || missingAnswerCount > 0}
                          className="bg-gray-900 text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingQuestions
                            ? 'Saving…'
                            : unassignedCount > 0
                            ? `${unassignedCount} questions need topics`
                            : missingAnswerCount > 0
                            ? `${missingAnswerCount} questions need answers`
                            : 'Save All Questions'}
                        </button>
                      </>
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
