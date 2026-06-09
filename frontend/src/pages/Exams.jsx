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
  const [availableClasses, setAvailableClasses] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
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

  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiExamId, setAiExamId] = useState(null)
  const [aiExamSubjects, setAiExamSubjects] = useState([])
  const [aiTotalQuestions, setAiTotalQuestions] = useState('')
  const [aiTopicAllocations, setAiTopicAllocations] = useState({})
  const [aiSelectedTopics, setAiSelectedTopics] = useState({})
  const [aiBoard, setAiBoard] = useState('CBSE')
  const [aiClassLevel, setAiClassLevel] = useState('')
  const [aiChapterNames, setAiChapterNames] = useState({})
  const [aiEasy, setAiEasy] = useState(30)
  const [aiMedium, setAiMedium] = useState(50)
  const [aiHard, setAiHard] = useState(20)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [generating, setGenerating] = useState(false)
  const [savingGenerated, setSavingGenerated] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiStep, setAiStep] = useState(1)

  const [activeProfileExamId, setActiveProfileExamId] = useState(null)
  const [examProfile, setExamProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const questionsPanelRef = useRef(null)

  async function getAuthUser() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error(userError?.message ?? 'Not authenticated')
    return user
  }

  async function fetchSubjects() {
    const user = await getAuthUser()

    if (userRole === 'teacher') {
      const { data: assignments, error: assignError } = await supabase
        .from('class_teachers')
        .select('subject_id')
        .eq('teacher_id', user.id)

      if (assignError) throw new Error(assignError.message)

      const assignedSubjectIds = [
        ...new Set(assignments?.map((a) => a.subject_id) ?? []),
      ]

      if (assignedSubjectIds.length === 0) {
        setSubjects([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', assignedSubjectIds)
        .order('name')

      if (fetchError) throw new Error(fetchError.message)
      setSubjects(data ?? [])
      return
    }

    const { data, error: fetchError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('institute_id', instituteId)
      .order('name')

    if (fetchError) throw new Error(fetchError.message)
    setSubjects(data ?? [])
  }

  async function fetchExams() {
    const { data, error: fetchError } = await supabase
      .from('exams')
      .select('id, name, exam_date, total_questions, scope, exam_subjects(subject_id, question_from, question_to, subjects(name)), exam_classes(class_id, classes(name))')
      .order('created_at', { ascending: false })
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
          .select('class_id, subject_id')
          .eq('teacher_id', user.id)

        setTeacherAssignments(tcData ?? [])

        const allTeacherClassIds = [...new Set(tcData?.map((a) => a.class_id) ?? [])]
        if (allTeacherClassIds.length > 0) {
          const { data: classDetails } = await supabase
            .from('classes')
            .select('id, name')
            .in('id', allTeacherClassIds)
            .order('name')
          setAvailableClasses(classDetails ?? [])
        } else {
          setAvailableClasses([])
        }
      } else {
        setTeacherAssignments([])
        setAvailableClasses([])
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

  useEffect(() => {
    if (userRole !== 'teacher') return

    const relevantSubjectIds = teacherAssignments
      .filter((a) => selectedClassIds.includes(a.class_id))
      .map((a) => a.subject_id)

    setSelectedSubjects((prev) =>
      prev.filter((s) => relevantSubjectIds.includes(s.subject_id))
    )
  }, [selectedClassIds, userRole, teacherAssignments])

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

  function getTopicOptionLabel(topic) {
    if (!topic.class_id) return `${topic.name} (General)`
    const className = activeExam?.exam_classes?.find(
      (ec) => ec.class_id === topic.class_id
    )?.classes?.name
    const classIds = activeExam?.exam_classes?.map((ec) => ec.class_id) ?? []
    if (classIds.length > 1 && className) return `${topic.name} (${className})`
    return topic.name
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

    const classIds = exam.exam_classes?.map((ec) => ec.class_id) ?? []
    const primaryClassId = classIds[0] ?? null

    let topicQuery = supabase
      .from('topics')
      .select('id, name, subject_id, class_id, subjects(name)')
      .in('subject_id', subjectIds)

    if (primaryClassId) {
      topicQuery = topicQuery.or(`class_id.eq.${primaryClassId},class_id.is.null`)
    }

    const { data, error: fetchError } = await topicQuery.order('name')
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

  async function toggleExamProfile(exam) {
    if (activeProfileExamId === exam.id) {
      setActiveProfileExamId(null)
      setExamProfile(null)
      return
    }
    setActiveProfileExamId(exam.id)
    setLoadingProfile(true)

    const { data } = await supabase
      .from('questions')
      .select('id, question_number, correct_answer, question_text, option_a, option_b, option_c, option_d, difficulty, topic_id, topics(name, subjects(name))')
      .eq('exam_id', exam.id)
      .order('question_number')

    setExamProfile(data ?? [])
    setLoadingProfile(false)
  }

  async function openAIGenerator(exam) {
    setAiExamId(exam.id)
    setGeneratedQuestions([])
    setAiError(null)
    setAiTopicAllocations({})
    setAiSelectedTopics({})
    setAiChapterNames({})
    setAiTotalQuestions('')
    setAiStep(1)
    setShowAIGenerator(true)

    const examSubjects = exam.exam_subjects ?? []
    const subjectIds = examSubjects.map((es) => es.subject_id)

    if (subjectIds.length === 0) return

    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, name, subject_id')
      .in('subject_id', subjectIds)
      .order('name')

    const classId = exam.exam_classes?.[0]?.class_id
    if (classId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single()
      setAiClassLevel(classData?.name ?? '')
    } else {
      setAiClassLevel('')
    }

    const subjects = examSubjects.map((es) => ({
      subject_id: es.subject_id,
      subject_name: es.subjects?.name ?? '',
      range_from: es.question_from,
      range_to: es.question_to,
      topics: topicsData?.filter((t) => t.subject_id === es.subject_id) ?? [],
    }))

    setAiExamSubjects(subjects)
  }

  async function handleGenerateQuestions() {
    setGenerating(true)
    setAiError(null)

    try {
      const allQuestions = []

      for (const subject of aiExamSubjects) {
        const selectedTopics = subject.topics.filter(
          (t) => aiSelectedTopics[t.id] && aiTopicAllocations[t.id] > 0
        )
        if (selectedTopics.length === 0) continue

        const chapterInput = aiChapterNames[subject.subject_id]?.trim()
        const topicNames = selectedTopics.map((t) => t.name)
        const chapterContext = chapterInput || topicNames.join(', ')

        const topicAllocList = selectedTopics.map((t) => ({
          topic_id: t.id,
          topic_name: t.name,
          count: aiTopicAllocations[t.id] ?? 1,
        }))

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/generate-questions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject_name: subject.subject_name,
              chapter_context: chapterContext,
              topic_allocations: topicAllocList,
              difficulty_mix: {
                easy: aiEasy,
                medium: aiMedium,
                hard: aiHard,
              },
              board: aiBoard,
              class_level: aiClassLevel,
            }),
          }
        )

        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Generation failed')
        allQuestions.push(...(data.questions ?? []))
      }

      setGeneratedQuestions(allQuestions)
      setAiStep(4)
    } catch (err) {
      setAiError(err.message)
    }

    setGenerating(false)
  }

  async function handleSaveGeneratedQuestions() {
    if (!aiExamId || generatedQuestions.length === 0) return
    setSavingGenerated(true)

    try {
      const { data: existing } = await supabase
        .from('questions')
        .select('question_number')
        .eq('exam_id', aiExamId)
        .order('question_number', { ascending: false })
        .limit(1)

      const startNum = (existing?.[0]?.question_number ?? 0) + 1

      const rows = generatedQuestions.map((q, i) => ({
        exam_id: aiExamId,
        question_number: startNum + i,
        topic_id: q.topic_id,
        correct_answer: q.correct_answer,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        difficulty: q.difficulty ?? 'medium',
      }))

      const { error } = await supabase.from('questions').insert(rows)

      if (error) throw new Error(error.message)

      setGeneratedQuestions([])
      setShowAIGenerator(false)
      setAiExamId(null)
      setAiStep(1)
      setSuccessMessage(`${rows.length} AI questions saved to exam!`)
      await fetchExams()
      if (activeProfileExamId === aiExamId) {
        const { data: refreshed } = await supabase
          .from('questions')
          .select('id, question_number, correct_answer, question_text, option_a, option_b, option_c, option_d, difficulty, topic_id, topics(name, subjects(name))')
          .eq('exam_id', aiExamId)
          .order('question_number')
        setExamProfile(refreshed ?? [])
      }
    } catch (err) {
      setAiError(err.message)
    }

    setSavingGenerated(false)
  }

  const primaryClassName = activeExam?.exam_classes?.[0]?.classes?.name
  const examClassCount = activeExam?.exam_classes?.length ?? 0
  const activeSubjectTopics = topics.filter((t) => t.subject_id === activeSubjectId)
  const gridNums = getActiveSubjectRange()
  const allNums = activeExam ? getAllQuestionNums() : []
  const unassignedCount = activeExam ? getUnassignedCount() : 0
  const missingAnswerCount = activeExam ? getMissingAnswerCount() : 0
  const relevantSubjectIds = userRole === 'teacher'
    ? teacherAssignments
        .filter((a) => selectedClassIds.includes(a.class_id))
        .map((a) => a.subject_id)
    : []

  const filteredSubjects = userRole === 'teacher'
    ? subjects.filter((s) => relevantSubjectIds.includes(s.id))
    : subjects

  const displayClasses = userRole === 'admin' ? classes : availableClasses

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
                  ? 'Select Classes'
                  : `Select Class${scope === 'multiple' ? 'es' : ''}`}
              </label>
              <div className="flex flex-wrap gap-2">
                {displayClasses.map((c) => (
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
                          : userRole === 'teacher' || scope === 'multiple'
                            ? [...prev, c.id]
                            : [c.id]
                      )}
                      className="hidden"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              {displayClasses.length === 0 && (
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
            {userRole === 'teacher' && selectedClassIds.length === 0 ? (
              <p className="text-sm text-gray-400">Select one or more classes to see subjects.</p>
            ) : filteredSubjects.length === 0 ? (
              <p className="text-sm text-gray-400">No subjects found. Add subjects on the Subjects page first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredSubjects.map((s) => {
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
                      <button
                        type="button"
                        onClick={() => toggleExamProfile(exam)}
                        className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors"
                      >
                        {exam.name}
                      </button>
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
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => activeExam?.id === exam.id ? closeQuestionsPanel() : openQuestionsPanel(exam)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {activeExam?.id === exam.id ? 'Close' : 'Add Questions'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openAIGenerator(exam)}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700"
                      >
                        🤖 Generate with AI
                      </button>
                    </div>
                  </div>
                </div>

                {activeProfileExamId === exam.id && (
                  <div className="mt-1 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-900">
                        Exam Profile — {exam.name}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProfileExamId(null)
                          setExamProfile(null)
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>

                    {loadingProfile ? (
                      <p className="text-sm text-gray-500">Loading questions…</p>
                    ) : !examProfile?.length ? (
                      <p className="text-sm text-gray-400">No questions added yet.</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-4">
                          {examProfile.length} question{examProfile.length !== 1 ? 's' : ''} saved
                        </p>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {examProfile.map((q) => (
                            <div
                              key={q.id}
                              className="border border-gray-100 rounded-xl p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-700">
                                  Q{q.question_number}
                                </span>
                                <span className="text-xs text-blue-600">
                                  {q.topics?.subjects?.name ?? 'Subject'} — {q.topics?.name ?? 'Topic'}
                                </span>
                                {q.difficulty && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                                    {q.difficulty}
                                  </span>
                                )}
                                <span className="text-xs text-green-600 font-medium ml-auto">
                                  Answer: {q.correct_answer}
                                </span>
                              </div>
                              {q.question_text ? (
                                <p className="text-sm text-gray-900 mb-2">{q.question_text}</p>
                              ) : (
                                <p className="text-sm text-gray-400 italic mb-2">No question text</p>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {['a', 'b', 'c', 'd'].map((opt) => {
                                  const letter = opt.toUpperCase()
                                  const value = q[`option_${opt}`]
                                  if (!value) return null
                                  return (
                                    <p
                                      key={opt}
                                      className={`text-xs px-2 py-1 rounded ${
                                        q.correct_answer === letter
                                          ? 'bg-green-50 text-green-800 font-medium'
                                          : 'text-gray-600'
                                      }`}
                                    >
                                      {letter}. {value}
                                    </p>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeExam?.id === exam.id && (
                  <div
                    ref={questionsPanelRef}
                    className="mt-2 bg-white rounded-xl border border-blue-200 p-6 shadow-sm"
                  >
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">
                      Add Questions — {activeExam.name}
                    </h2>
                    {primaryClassName && (
                      <p className="text-xs text-gray-500 mb-4">
                        Topics for {primaryClassName}
                        {examClassCount > 1 && ' (first linked class)'}
                      </p>
                    )}
                    {!primaryClassName && activeExam.scope !== 'institute' && (
                      <p className="text-xs text-gray-500 mb-4">No class linked — showing all topics.</p>
                    )}

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
                                  <option key={t.id} value={t.id}>{getTopicOptionLabel(t)}</option>
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
                                      {getTopicOptionLabel(t)} ({count})
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

                {showAIGenerator && aiExamId === exam.id && (
                  <div className="mt-2 bg-white rounded-xl border border-purple-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-900">
                        🤖 Generate Questions with AI
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAIGenerator(false)
                          setAiExamId(null)
                          setGeneratedQuestions([])
                          setAiStep(1)
                        }}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex gap-2 mb-5">
                      {['Questions', 'Topics', 'Settings', 'Review'].map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              aiStep > i + 1
                                ? 'bg-green-500 text-white'
                                : aiStep === i + 1
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {aiStep > i + 1 ? '✓' : i + 1}
                          </span>
                          <span
                            className={`text-xs ${
                              aiStep === i + 1 ? 'text-purple-600 font-medium' : 'text-gray-400'
                            }`}
                          >
                            {s}
                          </span>
                          {i < 3 && <span className="text-gray-300 text-xs">›</span>}
                        </div>
                      ))}
                    </div>

                    {aiStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            How many total questions do you want to generate?
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={aiTotalQuestions}
                            onChange={(e) => setAiTotalQuestions(e.target.value)}
                            placeholder="e.g. 30"
                            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Exam has {exam.total_questions} total questions
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!aiTotalQuestions || Number(aiTotalQuestions) < 1}
                          onClick={() => setAiStep(2)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                        >
                          Next: Select Topics →
                        </button>
                      </div>
                    )}

                    {aiStep === 2 && (
                      <div className="space-y-5">
                        {aiExamSubjects.map((subject) => {
                          const subjectTotal = subject.range_to - subject.range_from + 1
                          const subjectAllocated = subject.topics
                            .filter((t) => aiSelectedTopics[t.id])
                            .reduce((sum, t) => sum + (aiTopicAllocations[t.id] ?? 0), 0)
                          const subjectRemaining = subjectTotal - subjectAllocated

                          return (
                            <div
                              key={subject.subject_id}
                              className="border border-gray-100 rounded-xl p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  {subject.subject_name}
                                </h3>
                                <span className="text-xs text-gray-500">
                                  Q{subject.range_from}–Q{subject.range_to} ({subjectTotal} questions)
                                </span>
                              </div>

                              <div className="mb-3">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>Allocated: {subjectAllocated}</span>
                                  <span className={subjectRemaining < 0 ? 'text-red-500' : 'text-green-600'}>
                                    Remaining: {subjectRemaining}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      subjectAllocated > subjectTotal ? 'bg-red-500' : 'bg-purple-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, (subjectAllocated / subjectTotal) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                {subject.topics.map((topic) => (
                                  <div key={topic.id} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={!!aiSelectedTopics[topic.id]}
                                      onChange={(e) => {
                                        setAiSelectedTopics((prev) => ({
                                          ...prev,
                                          [topic.id]: e.target.checked,
                                        }))
                                        if (!e.target.checked) {
                                          setAiTopicAllocations((prev) => ({
                                            ...prev,
                                            [topic.id]: 0,
                                          }))
                                        }
                                      }}
                                      className="rounded border-gray-300 text-purple-600"
                                    />
                                    <span className="text-sm text-gray-900 flex-1">{topic.name}</span>
                                    {aiSelectedTopics[topic.id] && (
                                      <input
                                        type="number"
                                        min={1}
                                        max={subjectTotal}
                                        value={aiTopicAllocations[topic.id] ?? ''}
                                        onChange={(e) =>
                                          setAiTopicAllocations((prev) => ({
                                            ...prev,
                                            [topic.id]: Number(e.target.value),
                                          }))
                                        }
                                        placeholder="Q count"
                                        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        {(() => {
                          const totalAllocated = Object.values(aiTopicAllocations).reduce(
                            (sum, v) => sum + (v || 0),
                            0
                          )
                          const target = Number(aiTotalQuestions)
                          return (
                            <div
                              className={`text-sm font-medium p-3 rounded-lg ${
                                totalAllocated === target
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-yellow-50 text-yellow-700'
                              }`}
                            >
                              Total allocated: {totalAllocated} / {target}
                              {totalAllocated === target && ' ✓ Ready!'}
                              {totalAllocated > target && ' ⚠️ Over limit'}
                              {totalAllocated < target && ` (${target - totalAllocated} more needed)`}
                            </div>
                          )
                        })()}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAiStep(1)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            disabled={
                              Object.values(aiSelectedTopics).filter(Boolean).length === 0 ||
                              Object.values(aiTopicAllocations).reduce((s, v) => s + (v || 0), 0) !==
                                Number(aiTotalQuestions)
                            }
                            onClick={() => setAiStep(3)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                          >
                            Next: Settings →
                          </button>
                        </div>
                      </div>
                    )}

                    {aiStep === 3 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Exam Board
                            </label>
                            <select
                              value={aiBoard}
                              onChange={(e) => setAiBoard(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              {['CBSE', 'ICSE', 'State Board', 'JEE', 'NEET', 'Internal Test'].map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Class Level
                            </label>
                            <input
                              type="text"
                              value={aiClassLevel}
                              onChange={(e) => setAiClassLevel(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="e.g. Class 10"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Difficulty Distribution
                          </label>
                          <div className="flex gap-2 mb-3">
                            {[
                              { label: 'Balanced', e: 30, m: 50, h: 20 },
                              { label: 'Easy Focus', e: 60, m: 30, h: 10 },
                              { label: 'Tough', e: 10, m: 40, h: 50 },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => {
                                  setAiEasy(p.e)
                                  setAiMedium(p.m)
                                  setAiHard(p.h)
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                  aiEasy === p.e && aiMedium === p.m && aiHard === p.h
                                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                                    : 'border-gray-300 text-gray-600'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-2">
                            {[
                              { label: 'Easy', value: aiEasy, setter: setAiEasy, color: 'text-green-600' },
                              { label: 'Medium', value: aiMedium, setter: setAiMedium, color: 'text-yellow-600' },
                              { label: 'Hard', value: aiHard, setter: setAiHard, color: 'text-red-600' },
                            ].map(({ label, value, setter, color }) => (
                              <div key={label} className="flex items-center gap-3">
                                <span className={`text-xs font-medium w-12 ${color}`}>{label}</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={value}
                                  onChange={(e) => setter(Number(e.target.value))}
                                  className="flex-1"
                                />
                                <span className={`text-xs font-bold w-8 text-right ${color}`}>{value}%</span>
                              </div>
                            ))}
                            {aiEasy + aiMedium + aiHard !== 100 && (
                              <p className="text-xs text-red-500">
                                Total: {aiEasy + aiMedium + aiHard}% (must be 100%)
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {aiExamSubjects
                            .filter((s) => s.topics.some((t) => aiSelectedTopics[t.id]))
                            .map((subject) => {
                              const selectedTopicNames = subject.topics
                                .filter((t) => aiSelectedTopics[t.id])
                                .map((t) => t.name)
                                .join(', ')
                              return (
                                <div key={subject.subject_id}>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    {subject.subject_name} — Chapter/Topic context (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={aiChapterNames[subject.subject_id] ?? ''}
                                    onChange={(e) =>
                                      setAiChapterNames((prev) => ({
                                        ...prev,
                                        [subject.subject_id]: e.target.value,
                                      }))
                                    }
                                    placeholder={selectedTopicNames}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                                  />
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Leave empty to use topic names: {selectedTopicNames}
                                  </p>
                                </div>
                              )
                            })}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAiStep(2)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            disabled={aiEasy + aiMedium + aiHard !== 100 || generating}
                            onClick={handleGenerateQuestions}
                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                          >
                            {generating ? '⏳ Generating...' : '✨ Generate Questions'}
                          </button>
                        </div>

                        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                      </div>
                    )}

                    {aiStep === 4 && generatedQuestions.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {generatedQuestions.length} questions generated — review and edit:
                        </p>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {generatedQuestions.map((q, index) => (
                            <div key={index} className="border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-purple-600 font-medium">
                                  {q.topic_name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      q.difficulty === 'easy'
                                        ? 'bg-green-50 text-green-600'
                                        : q.difficulty === 'hard'
                                          ? 'bg-red-50 text-red-600'
                                          : 'bg-yellow-50 text-yellow-600'
                                    }`}
                                  >
                                    {q.difficulty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGeneratedQuestions((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      )
                                    }
                                    className="text-xs text-red-400 hover:text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>

                              <textarea
                                value={q.question_text}
                                onChange={(e) =>
                                  setGeneratedQuestions((prev) =>
                                    prev.map((item, i) =>
                                      i === index
                                        ? { ...item, question_text: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 resize-none"
                                rows={2}
                              />

                              <div className="grid grid-cols-2 gap-2">
                                {['a', 'b', 'c', 'd'].map((opt) => (
                                  <div key={opt} className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setGeneratedQuestions((prev) =>
                                          prev.map((item, i) =>
                                            i === index
                                              ? { ...item, correct_answer: opt.toUpperCase() }
                                              : item
                                          )
                                        )
                                      }
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        q.correct_answer === opt.toUpperCase()
                                          ? 'bg-green-500 text-white'
                                          : 'bg-gray-100 text-gray-400'
                                      }`}
                                    >
                                      {opt.toUpperCase()}
                                    </button>
                                    <input
                                      type="text"
                                      value={q[`option_${opt}`]}
                                      onChange={(e) =>
                                        setGeneratedQuestions((prev) =>
                                          prev.map((item, i) =>
                                            i === index
                                              ? { ...item, [`option_${opt}`]: e.target.value }
                                              : item
                                          )
                                        )
                                      }
                                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAiStep(3)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveGeneratedQuestions}
                            disabled={savingGenerated}
                            className="flex-1 bg-gray-900 text-white font-medium py-2.5 rounded-lg disabled:opacity-40"
                          >
                            {savingGenerated
                              ? 'Saving...'
                              : `Save ${generatedQuestions.length} Questions`}
                          </button>
                        </div>
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
