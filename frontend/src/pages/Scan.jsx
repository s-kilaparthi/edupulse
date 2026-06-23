import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'
import Loader from '../components/Loader'

const API_URL = import.meta.env.VITE_API_URL
const ANSWERS = ['A', 'B', 'C', 'D']
const DEFAULT_QUESTION_COUNT = 50

function Spinner() {
  return (
    <div className="flex justify-center items-center h-32">
      <Loader size={40} />
    </div>
  )
}

function parseScanResponse(data, questionCount) {
  const answers = {}
  const ambiguous = new Set()

  if (data.answers && typeof data.answers === 'object') {
    for (const [k, v] of Object.entries(data.answers)) {
      const n = Number(k)
      answers[n] = v ? String(v).toUpperCase() : ''
    }
  }

  for (const q of data.ambiguous ?? []) {
    ambiguous.add(Number(q))
  }

  for (let i = 1; i <= questionCount; i++) {
    if (!(i in answers)) answers[i] = ''
    if (!answers[i] || ambiguous.has(i)) ambiguous.add(i)
  }

  return {
    answers,
    ambiguous,
    confidence: data.confidence ?? null,
  }
}

async function buildStudentAndParentNotifications({
  studentId,
  rollNumber,
  title,
  body,
  type = 'results',
  instituteId,
}) {
  const rows = [
    {
      user_id: studentId,
      title,
      body,
      type,
      is_read: false,
    },
  ]

  if (!instituteId || rollNumber == null || rollNumber === '') return rows

  const { data: parent } = await supabase
    .from('users')
    .select('id')
    .eq('roll_number', String(rollNumber))
    .eq('role', 'parent')
    .eq('institute_id', instituteId)
    .limit(1)
    .maybeSingle()

  if (parent) {
    rows.push({
      user_id: parent.id,
      title,
      body,
      type,
      is_read: false,
    })
  }

  return rows
}

export default function Scan() {
  const { session } = useOutletContext()
  const [userRole, setUserRole] = useState('')
  const [instituteId, setInstituteId] = useState(null)
  const [step, setStep] = useState(1)
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [filteredStudents, setFilteredStudents] = useState([])
  const [rollNumber, setRollNumber] = useState('')
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [scanError, setScanError] = useState('')
  const [confidence, setConfidence] = useState(null)
  const [answers, setAnswers] = useState({})
  const [ambiguousSet, setAmbiguousSet] = useState(new Set())
  const [sessionRecords, setSessionRecords] = useState([])
  const [showReview, setShowReview] = useState(false)
  const [reviewStudents, setReviewStudents] = useState([])
  const [absentStudentIds, setAbsentStudentIds] = useState(new Set())
  const [postingResults, setPostingResults] = useState(false)
  const [scanTab, setScanTab] = useState('class')
  const [rollScanRoll, setRollScanRoll] = useState('')
  const [rollScanStudentId, setRollScanStudentId] = useState('')
  const [rollScanStudentName, setRollScanStudentName] = useState('')
  const [rollScanRecords, setRollScanRecords] = useState([])
  const [absentRoll, setAbsentRoll] = useState('')
  const [absentStudentId, setAbsentStudentId] = useState('')
  const [absentStudentName, setAbsentStudentName] = useState('')
  const [absentList, setAbsentList] = useState([])
  const [activeScanMode, setActiveScanMode] = useState('class')
  const [gradingMode, setGradingMode] = useState(null)
  const [writtenStep, setWrittenStep] = useState(1)
  const [writtenClassId, setWrittenClassId] = useState('')
  const [writtenExamId, setWrittenExamId] = useState('')
  const [writtenExams, setWrittenExams] = useState([])
  const [writtenStudents, setWrittenStudents] = useState([])
  const [writtenSearch, setWrittenSearch] = useState('')
  const [expandedStudentId, setExpandedStudentId] = useState(null)
  const [writtenPoorQuestions, setWrittenPoorQuestions] = useState({})
  const [writtenMarks, setWrittenMarks] = useState({})
  const [gradedStudentIds, setGradedStudentIds] = useState(new Set())
  const [submittedStudentIds, setSubmittedStudentIds] = useState(new Set())
  const [reviewStudentId, setReviewStudentId] = useState(null)
  const [writtenExamQuestions, setWrittenExamQuestions] = useState([])
  const [writtenSavingId, setWrittenSavingId] = useState(null)
  const [writtenConfirmingAll, setWrittenConfirmingAll] = useState(false)
  const [writtenError, setWrittenError] = useState('')
  const [writtenSuccessToast, setWrittenSuccessToast] = useState('')
  const fileRef = useRef(null)
  const fileRefRoll = useRef(null)

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === examId),
    [exams, examId]
  )

  const questionCount = selectedExam?.total_questions ?? DEFAULT_QUESTION_COUNT

  const availableClasses = useMemo(() => {
    if (!selectedExam) return classes
    if (selectedExam.scope === 'institute') return classes
    const examClassIds = (selectedExam.exam_classes ?? []).map((ec) => ec.class_id)
    return classes.filter((c) => examClassIds.includes(c.id))
  }, [selectedExam, classes])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId),
    [students, studentId]
  )

  const canScan = userRole === 'teacher' || userRole === 'admin'
  const showScanUI = !userRole || canScan

  const writtenSelectedExam = useMemo(
    () => writtenExams.find((e) => e.id === writtenExamId),
    [writtenExams, writtenExamId]
  )

  const writtenQuestionCount = writtenSelectedExam?.total_questions ?? DEFAULT_QUESTION_COUNT
  const writtenTotalMarks = writtenSelectedExam?.total_marks ?? null

  const filteredWrittenStudents = useMemo(() => {
    const q = writtenSearch.trim().toLowerCase()
    if (!q) return writtenStudents
    return writtenStudents.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        String(s.roll_number ?? '').toLowerCase().includes(q)
    )
  }, [writtenStudents, writtenSearch])

  function resetWrittenGrading() {
    setWrittenStep(1)
    setWrittenClassId('')
    setWrittenExamId('')
    setWrittenExams([])
    setWrittenStudents([])
    setWrittenSearch('')
    setExpandedStudentId(null)
    setWrittenPoorQuestions({})
    setWrittenMarks({})
    setGradedStudentIds(new Set())
    setSubmittedStudentIds(new Set())
    setReviewStudentId(null)
    setWrittenExamQuestions([])
    setWrittenSavingId(null)
    setWrittenConfirmingAll(false)
    setWrittenError('')
    setWrittenSuccessToast('')
  }

  function buildWrittenReviewData(studentId) {
    const poorArr = writtenPoorQuestions[studentId] ?? []
    const poorSet = new Set(poorArr)
    const good = []
    const poor = []

    for (let i = 1; i <= writtenQuestionCount; i++) {
      if (poorSet.has(i)) poor.push(i)
      else good.push(i)
    }

    const topicPoorMap = {}
    for (const q of writtenExamQuestions) {
      if (poorSet.has(q.question_number)) {
        const name = q.topics?.name ?? 'Unknown topic'
        if (!topicPoorMap[name]) topicPoorMap[name] = []
        topicPoorMap[name].push(q.question_number)
      }
    }

    return {
      marks: writtenMarks[studentId] ?? '',
      good,
      poor,
      topicPoorMap,
    }
  }

  async function loadWrittenStudentGradingData(studentId) {
    const [{ data: omrRows }, { data: summary }] = await Promise.all([
      supabase
        .from('omr_results')
        .select('is_correct, questions(question_number)')
        .eq('exam_id', writtenExamId)
        .eq('student_id', studentId)
        .not('question_id', 'is', null),
      supabase
        .from('omr_results')
        .select('marks_obtained')
        .eq('exam_id', writtenExamId)
        .eq('student_id', studentId)
        .is('question_id', null)
        .maybeSingle(),
    ])

    if (!omrRows?.length && !summary) {
      setWrittenPoorQuestions((prev) => ({ ...prev, [studentId]: [] }))
      setWrittenMarks((prev) => ({ ...prev, [studentId]: '' }))
      return
    }

    const poor = []
    for (const row of omrRows ?? []) {
      const qNum = row.questions?.question_number
      if (qNum == null) continue
      if (!row.is_correct) poor.push(qNum)
    }

    const marks =
      summary?.marks_obtained != null
        ? String(summary.marks_obtained)
        : ''

    setWrittenPoorQuestions((prev) => ({ ...prev, [studentId]: poor }))
    setWrittenMarks((prev) => ({ ...prev, [studentId]: marks }))
  }

  async function preloadGradedStudentData(studentIds) {
    if (studentIds.length === 0) return

    const [{ data: omrRows }, { data: summaries }] = await Promise.all([
      supabase
        .from('omr_results')
        .select('student_id, is_correct, questions(question_number)')
        .eq('exam_id', writtenExamId)
        .in('student_id', studentIds)
        .not('question_id', 'is', null),
      supabase
        .from('omr_results')
        .select('student_id, marks_obtained')
        .eq('exam_id', writtenExamId)
        .in('student_id', studentIds)
        .is('question_id', null),
    ])

    const poorMap = {}
    const marksMap = {}
    for (const sid of studentIds) {
      poorMap[sid] = []
    }

    for (const row of omrRows ?? []) {
      const sid = row.student_id
      const qNum = row.questions?.question_number
      if (qNum == null) continue
      if (!row.is_correct) poorMap[sid].push(qNum)
    }

    for (const row of summaries ?? []) {
      if (row.marks_obtained != null) {
        marksMap[row.student_id] = String(row.marks_obtained)
      }
    }

    setWrittenPoorQuestions((prev) => ({ ...prev, ...poorMap }))
    setWrittenMarks((prev) => ({ ...prev, ...marksMap }))
  }

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
    if (!canScan) return

    async function loadExamsAndClasses() {
      const { data, error } = await supabase
        .from('exams')
        .select('id, name, total_questions, scope, exam_classes(class_id, classes(name))')
        .eq('exam_type', 'mcq')
        .order('created_at', { ascending: false })
      if (!error && data) setExams(data)

      if (instituteId) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', instituteId)
          .order('name')
        if (classData) setClasses(classData)
      }
    }
    loadExamsAndClasses()
  }, [canScan, instituteId])

  useEffect(() => {
    if (gradingMode !== 'written' || !writtenClassId) {
      setWrittenExams([])
      setWrittenExamId('')
      return
    }

    supabase
      .from('exams')
      .select('id, name, total_questions, total_marks, exam_classes(class_id)')
      .eq('exam_type', 'written')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const filtered = (data ?? []).filter((ex) =>
          ex.exam_classes?.some((ec) => ec.class_id === writtenClassId)
        )
        setWrittenExams(filtered)
        setWrittenExamId((prev) =>
          filtered.some((e) => e.id === prev) ? prev : ''
        )
      })
  }, [gradingMode, writtenClassId])

  useEffect(() => {
    if (!canScan) return

    let query = supabase
      .from('users')
      .select('id, name, roll_number, class_id')
      .eq('role', 'student')
      .order('roll_number')

    if (instituteId) {
      query = query.eq('institute_id', instituteId)
    }

    query.then(({ data, error }) => {
      if (!error && data) setStudents(data)
    })
  }, [canScan, instituteId])

  useEffect(() => {
    setSelectedClassId('')
    setFilteredStudents([])
  }, [examId])

  useEffect(() => {
    if (!selectedClassId) {
      setFilteredStudents(students)
      return
    }
    setFilteredStudents(students.filter((s) => s.class_id === selectedClassId))
  }, [selectedClassId, students])

  useEffect(() => {
    if (!rollNumber.trim()) {
      setStudentName('')
      return
    }
    const match = filteredStudents.find(
      (s) => String(s.roll_number).toLowerCase() === rollNumber.trim().toLowerCase()
    )
    if (match) {
      setStudentId(match.id)
      setStudentName(match.name ?? '')
    } else {
      setStudentId('')
      setStudentName('')
    }
  }, [rollNumber, filteredStudents])

  useEffect(() => {
    if (!rollScanRoll.trim()) {
      setRollScanStudentId('')
      setRollScanStudentName('')
      return
    }
    let query = supabase
      .from('users')
      .select('id, name')
      .eq('roll_number', rollScanRoll.trim())
      .eq('role', 'student')

    if (instituteId) {
      query = query.eq('institute_id', instituteId)
    }

    query.maybeSingle().then(({ data }) => {
      if (!data) {
        setRollScanStudentId('')
        setRollScanStudentName('Student not found')
        return
      }
      setRollScanStudentId(data.id)
      setRollScanStudentName(data.name)
    })
  }, [rollScanRoll, instituteId])

  useEffect(() => {
    if (!absentRoll.trim()) {
      setAbsentStudentId('')
      setAbsentStudentName('')
      return
    }
    let query = supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('roll_number', absentRoll.trim())
      .eq('role', 'student')

    if (instituteId) {
      query = query.eq('institute_id', instituteId)
    }

    query.maybeSingle().then(({ data }) => {
      if (!data) {
        setAbsentStudentId('')
        setAbsentStudentName('Student not found')
        return
      }
      setAbsentStudentId(data.id)
      setAbsentStudentName(data.name)
    })
  }, [absentRoll, instituteId])

  const resetStudentFields = useCallback(() => {
    setRollNumber('')
    setStudentId('')
    setStudentName('')
    setAnswers({})
    setAmbiguousSet(new Set())
    setConfidence(null)
    setScanError('')
    setSavedFlash(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleStudentSelect = (id) => {
    setStudentId(id)
    const s = filteredStudents.find((x) => x.id === id)
    if (s) {
      setRollNumber(String(s.roll_number ?? ''))
      setStudentName(s.name ?? '')
    }
  }

  function resizeImage(file, maxSize) {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const { width, height } = img
        const longest = Math.max(width, height)

        if (longest <= maxSize) {
          resolve(file)
          return
        }

        const scale = maxSize / longest
        const newWidth = Math.round(width * scale)
        const newHeight = Math.round(height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = newWidth
        canvas.height = newHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        canvas.toBlob((blob) => {
          const resized = new File([blob], file.name, { type: 'image/jpeg' })
          resolve(resized)
        }, 'image/jpeg', 0.92)
      }
      img.src = url
    })
  }

  async function processFile(file, { studentId: scanStudentId, mode = 'class' } = {}) {
    const sid = scanStudentId ?? studentId
    if (!file || !selectedExam || !sid) {
      setScanError('Select exam and student before uploading.')
      return
    }
    setActiveScanMode(mode)
    setStudentId(sid)
    setScanError('')
    setScanning(true)
    try {
      const resizedFile = await resizeImage(file, 1600)

      const form = new FormData()
      form.append('file', resizedFile)

      const res = await fetch(`${API_URL}/scan-omr`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail
        const message = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg).join(', ')
            : `Scan failed (${res.status})`
        throw new Error(message)
      }

      const data = await res.json()
      const { answers: next, ambiguous, confidence: conf } = parseScanResponse(data, questionCount)
      setAnswers(next)
      setAmbiguousSet(ambiguous)
      setConfidence(conf)
      setStep(3)
    } catch (err) {
      setScanError(err.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleFile = async (e) => {
    await processFile(e.target.files?.[0], { mode: 'class' })
  }

  const handleFileForRoll = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    await processFile(file, { studentId: rollScanStudentId, mode: 'rollscan' })
    if (fileRefRoll.current) fileRefRoll.current.value = ''
  }

  const setManualAnswer = (qNum, value) => {
    setAnswers((prev) => ({ ...prev, [qNum]: value }))
    setAmbiguousSet((prev) => {
      const next = new Set(prev)
      if (value) next.delete(qNum)
      else next.add(qNum)
      return next
    })
  }

  const handleConfirmSave = async () => {
    if (!selectedExam || !studentId) return
    setSaving(true)
    setScanError('')
    try {
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('id, question_number, correct_answer, topic_id, topics(subject_id)')
        .eq('exam_id', selectedExam.id)
        .order('question_number')

      if (qErr) throw qErr
      console.log('questions fetched:', JSON.stringify(questions))
      const omrRows = (questions ?? []).map((q) => {
        const given = answers[q.question_number] ?? ''
        const correct = String(q.correct_answer ?? '').toUpperCase()
        return {
          exam_id: selectedExam.id,
          student_id: studentId,
          question_id: q.id,
          answer_given: given || null,
          is_correct: given === correct,
        }
      })

      const { error: insertErr } = await supabase
        .from('omr_results')
        .upsert(omrRows, { onConflict: 'exam_id,student_id,question_id' })
      if (insertErr) throw insertErr

      const topicMap = {}
      for (const q of questions ?? []) {
        const tid = q.topic_id
        const sid = q.topics?.subject_id ?? null
        if (!topicMap[tid]) topicMap[tid] = { score: 0, total: 0,  subject_id: sid }
        topicMap[tid].total += 1
        const given = answers[q.question_number] ?? ''
        if (given === String(q.correct_answer ?? '').toUpperCase()) {
          topicMap[tid].score += 1
        }
      }

      const topicRows = await Promise.all(
        Object.entries(topicMap).map(async ([topic_id, { score, total, subject_id }]) => {
          const { data: topicData } = await supabase
            .from('topics')
            .select('chapter_id')
            .eq('id', topic_id)
            .single()
          const chapter_id = topicData?.chapter_id ?? null
          return {
            exam_id: selectedExam.id,
            student_id: studentId,
            topic_id,
            chapter_id,
            subject_id: subject_id ?? null,
            score,
            total,
            percentage: total > 0 ? Math.round((score / total) * 100) : 0,
          }
        })
      )

      const { error: topicErr } = await supabase
        .from('topic_scores')
        .upsert(topicRows, { onConflict: 'exam_id,student_id,topic_id' })
      if (topicErr) throw topicErr

      const correctCount = omrRows.filter((r) => r.is_correct).length
      const pct = omrRows.length > 0 ? Math.round((correctCount / omrRows.length) * 100) : 0

      if (activeScanMode === 'rollscan') {
        setRollScanRecords((prev) => [
          ...prev,
          {
            studentId,
            name: rollScanStudentName || studentName,
            roll: rollScanRoll,
            score: pct,
          },
        ])
        setRollScanRoll('')
        setRollScanStudentId('')
        setRollScanStudentName('')
        if (fileRefRoll.current) fileRefRoll.current.value = ''
        setScanTab('rollscan')
      } else {
        setSessionRecords((prev) => [
          ...prev,
          {
            studentId,
            studentName: selectedStudent?.name ?? studentName,
            score: pct,
            topicMap,
          },
        ])
        resetStudentFields()
        setScanTab('class')
      }

      setSavedFlash(true)
      setTimeout(() => {
        setSavedFlash(false)
        setStep(2)
      }, 1200)
    } catch (err) {
      setScanError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenReview() {
    const { data } = await supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('role', 'student')
      .eq('class_id', selectedClassId)
      .order('roll_number')

    setReviewStudents(data ?? [])
    setShowReview(true)
  }

  async function handlePostResults() {
    setPostingResults(true)

    try {
      const notifRows = []
      for (const student of reviewStudents) {
        const rows = await buildStudentAndParentNotifications({
          studentId: student.id,
          rollNumber: student.roll_number,
          title: 'Results Posted',
          body: `Your results for ${selectedExam.name} are now available`,
          type: 'results',
          instituteId,
        })
        notifRows.push(...rows)
      }

      if (notifRows.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifRows)
        console.log('Notification insert result:', notifError)
        if (notifError) console.error('Notification error:', notifError)
      }

      setSavedFlash(true)
      setShowReview(false)
      setSessionRecords([])
      setAbsentStudentIds(new Set())
      setTimeout(() => {
        setSavedFlash(false)
        setStep(1)
      }, 2000)
    } catch (err) {
      setScanError('Failed to post results: ' + err.message)
    }

    setPostingResults(false)
  }

  async function handlePostRollResults() {
    setPostingResults(true)
    try {
      const notifRows = []
      for (const record of rollScanRecords) {
        const rows = await buildStudentAndParentNotifications({
          studentId: record.studentId,
          rollNumber: record.roll,
          title: 'Results Posted',
          body: `Your results for ${selectedExam.name} are now available`,
          type: 'results',
          instituteId,
        })
        notifRows.push(...rows)
      }

      if (notifRows.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifRows)
        console.log('Roll scan notification result:', notifError)
        if (notifError) console.error('Notification error:', notifError)
      }

      setSavedFlash(true)
      setRollScanRecords([])
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setScanError('Failed to post: ' + err.message)
    }
    setPostingResults(false)
  }

  async function handleConfirmAbsent() {
    if (!selectedExam || absentList.length === 0) return
    setPostingResults(true)

    try {
      const notifRows = absentList.map((s) => ({
        user_id: s.id,
        title: 'Marked Absent',
        body: `You were marked absent for ${selectedExam.name}`,
        type: 'absent',
        is_read: false,
      }))

      await supabase.from('notifications').insert(notifRows)

      setSavedFlash(true)
      setAbsentList([])
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setScanError('Failed to confirm: ' + err.message)
    }

    setPostingResults(false)
  }

  const sessionSummary = useMemo(() => {
    if (sessionRecords.length === 0) return null
    const avg = sessionRecords.reduce((s, r) => s + r.score, 0) / sessionRecords.length
    const topicAgg = {}
    for (const rec of sessionRecords) {
      for (const [tid, { score, total }] of Object.entries(rec.topicMap)) {
        if (!topicAgg[tid]) topicAgg[tid] = { score: 0, total: 0 }
        topicAgg[tid].score += score
        topicAgg[tid].total += total
      }
    }
    return { count: sessionRecords.length, avg, topicAgg }
  }, [sessionRecords])

  async function handleStartWrittenGrading() {
    if (!writtenClassId || !writtenExamId) return
    setWrittenError('')

    const { data: classStudents, error: studentsErr } = await supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('role', 'student')
      .eq('class_id', writtenClassId)
      .order('roll_number')

    if (studentsErr) {
      setWrittenError(studentsErr.message)
      return
    }

    const { data: questions, error: questionsErr } = await supabase
      .from('questions')
      .select('id, question_number, topic_id, topics(subject_id, name)')
      .eq('exam_id', writtenExamId)
      .order('question_number')

    if (questionsErr) {
      setWrittenError(questionsErr.message)
      return
    }

    const studentIds = (classStudents ?? []).map((s) => s.id)
    let graded = new Set()
    if (studentIds.length > 0) {
      const { data: gradedRows } = await supabase
        .from('topic_scores')
        .select('student_id')
        .eq('exam_id', writtenExamId)
        .in('student_id', studentIds)

      graded = new Set((gradedRows ?? []).map((r) => r.student_id))
    }

    setWrittenStudents(classStudents ?? [])
    setWrittenExamQuestions(questions ?? [])
    setGradedStudentIds(graded)
    setSubmittedStudentIds(new Set())
    setReviewStudentId(null)
    setWrittenPoorQuestions({})
    setWrittenMarks({})
    setExpandedStudentId(null)
    setWrittenSearch('')
    setWrittenStep(2)

    await preloadGradedStudentData([...graded])
  }

  async function handleExpandWrittenStudent(studentId) {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null)
      return
    }

    setReviewStudentId(null)
    setExpandedStudentId(studentId)
    setWrittenError('')

    if (!Object.prototype.hasOwnProperty.call(writtenPoorQuestions, studentId)) {
      await loadWrittenStudentGradingData(studentId)
    }
  }

  async function handleOpenWrittenReview(studentId) {
    setWrittenError('')
    if (!Object.prototype.hasOwnProperty.call(writtenPoorQuestions, studentId)) {
      await loadWrittenStudentGradingData(studentId)
    }
    setExpandedStudentId(null)
    setReviewStudentId(studentId)
  }

  function handleEditFromReview(studentId) {
    setReviewStudentId(null)
    setExpandedStudentId(studentId)
  }

  async function upsertWrittenExamSummary(studentId, marks) {
    const { error } = await supabase.from('omr_results').upsert(
      {
        exam_id: writtenExamId,
        student_id: studentId,
        question_id: null,
        answer_given: null,
        is_correct: null,
        marks_obtained: marks,
        total_marks: writtenTotalMarks,
      },
      { onConflict: 'exam_id,student_id,question_id' }
    )
    if (error) throw error
  }

  async function handleConfirmWrittenStudent(studentId) {
    const marks = parseInt(writtenMarks[studentId], 10)
    const examName = writtenSelectedExam?.name ?? 'Exam'

    if (!writtenTotalMarks) {
      setWrittenError('This exam has no total marks configured.')
      return
    }

    if (Number.isNaN(marks) || marks < 0 || marks > writtenTotalMarks) {
      setWrittenError(`Enter marks between 0 and ${writtenTotalMarks}`)
      return
    }

    setWrittenSavingId(studentId)
    setWrittenError('')

    try {
      await upsertWrittenExamSummary(studentId, marks)

      const student = writtenStudents.find((s) => s.id === studentId)
      const notifRows = await buildStudentAndParentNotifications({
        studentId,
        rollNumber: student?.roll_number,
        title: `Results Posted — ${examName}`,
        body: `You scored ${marks}/${writtenTotalMarks}. Check your results for topic feedback.`,
        type: 'result',
        instituteId,
      })

      const { error } = await supabase.from('notifications').insert(notifRows)

      if (error) throw error

      setSubmittedStudentIds((prev) => new Set([...prev, studentId]))
      setReviewStudentId(null)
      setWrittenSuccessToast('Results confirmed and student notified')
      setTimeout(() => setWrittenSuccessToast(''), 3000)
    } catch (err) {
      setWrittenError(err.message || 'Failed to notify student')
    }

    setWrittenSavingId(null)
  }

  async function handleConfirmAllWrittenStudents() {
    const pending = [...gradedStudentIds].filter((id) => !submittedStudentIds.has(id))
    if (pending.length === 0) return

    if (!writtenTotalMarks) {
      setWrittenError('This exam has no total marks configured.')
      return
    }

    if (!window.confirm('Confirm and notify all graded students? This cannot be undone.')) return

    setWrittenConfirmingAll(true)
    setWrittenError('')

    const examName = writtenSelectedExam?.name ?? 'Exam'

    try {
      for (const studentId of pending) {
        const marks = parseInt(writtenMarks[studentId], 10)
        await upsertWrittenExamSummary(studentId, marks)
      }

      const notifRows = []
      for (const studentId of pending) {
        const marks = parseInt(writtenMarks[studentId], 10)
        const student = writtenStudents.find((s) => s.id === studentId)
        const rows = await buildStudentAndParentNotifications({
          studentId,
          rollNumber: student?.roll_number,
          title: `Results Posted — ${examName}`,
          body: `You scored ${marks}/${writtenTotalMarks}. Check your results for topic feedback.`,
          type: 'result',
          instituteId,
        })
        notifRows.push(...rows)
      }

      const { error } = await supabase.from('notifications').insert(notifRows)
      if (error) throw error

      setSubmittedStudentIds((prev) => new Set([...prev, ...pending]))
      setWrittenSuccessToast('All results confirmed and students notified')
      setTimeout(() => setWrittenSuccessToast(''), 3000)
    } catch (err) {
      setWrittenError(err.message || 'Failed to notify students')
    }

    setWrittenConfirmingAll(false)
  }

  function toggleWrittenPoorQuestion(studentId, qNum) {
    setWrittenPoorQuestions((prev) => {
      const arr = prev[studentId] ?? []
      const has = arr.includes(qNum)
      return {
        ...prev,
        [studentId]: has ? arr.filter((n) => n !== qNum) : [...arr, qNum],
      }
    })
  }

  async function handleSaveWrittenStudent(studentId) {
    const poorArr = writtenPoorQuestions[studentId] ?? []
    const poorSet = new Set(poorArr)
    const marks = parseInt(writtenMarks[studentId], 10)

    if (!writtenTotalMarks) {
      setWrittenError('This exam has no total marks configured.')
      return
    }

    if (Number.isNaN(marks) || marks < 0 || marks > writtenTotalMarks) {
      setWrittenError(`Enter marks between 0 and ${writtenTotalMarks}`)
      return
    }

    setWrittenSavingId(studentId)
    setWrittenError('')

    try {
      const topicAgg = {}
      const omrRows = []

      for (const q of writtenExamQuestions) {
        const isPoor = poorSet.has(q.question_number)
        const tid = q.topic_id
        const sid = q.topics?.subject_id ?? null

        if (tid) {
          if (!topicAgg[tid]) topicAgg[tid] = { score: 0, total: 0, subject_id: sid }
          topicAgg[tid].total += 1
          if (!isPoor) topicAgg[tid].score += 1
        }

        omrRows.push({
          exam_id: writtenExamId,
          student_id: studentId,
          question_id: q.id,
          answer_given: q.question_number === 1 ? String(marks) : null,
          is_correct: !isPoor,
        })
      }

      if (omrRows.length === 0) {
        throw new Error('No questions found for this exam. Add questions in Exams first.')
      }

      const { error: omrErr } = await supabase
        .from('omr_results')
        .upsert(omrRows, { onConflict: 'exam_id,student_id,question_id' })
      if (omrErr) throw omrErr

      const topicRows = await Promise.all(
        Object.entries(topicAgg).map(async ([topic_id, { score, total, subject_id }]) => {
          const { data: topicData } = await supabase
            .from('topics')
            .select('chapter_id')
            .eq('id', topic_id)
            .single()
          const chapter_id = topicData?.chapter_id ?? null
          return {
            exam_id: writtenExamId,
            student_id: studentId,
            topic_id,
            chapter_id,
            subject_id: subject_id ?? null,
            score,
            total,
            percentage: total > 0 ? Math.round((score / total) * 100) : 0,
          }
        })
      )

      if (topicRows.length > 0) {
        const { error: topicErr } = await supabase
          .from('topic_scores')
          .upsert(topicRows, { onConflict: 'exam_id,student_id,topic_id' })
        if (topicErr) throw topicErr
      }

      setGradedStudentIds((prev) => new Set([...prev, studentId]))
      setSubmittedStudentIds((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
      setExpandedStudentId(null)
    } catch (err) {
      setWrittenError(err.message || 'Save failed')
    }

    setWrittenSavingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Grading</h1>

      {userRole === 'student' && (
        <p className="text-sm text-red-600">Grading is only available to teachers and admins.</p>
      )}

      {showScanUI && gradingMode === null && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setGradingMode('written')}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#262626] px-6 py-12 text-lg font-semibold text-gray-700 dark:text-[#A8A8A8] hover:border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
            >
              <span className="text-3xl">📝</span>
              Written Exam
            </button>
            <button
              type="button"
              onClick={() => setGradingMode('omr')}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 px-6 py-12 text-lg font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-100 transition-colors"
            >
              <span className="text-3xl">📷</span>
              OMR Scan
            </button>
          </div>
        </section>
      )}

      {showScanUI && gradingMode === 'written' && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <button
            type="button"
            onClick={() => {
              resetWrittenGrading()
              setGradingMode(null)
            }}
            className="text-sm text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]"
          >
            ← Back
          </button>

          <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">Written Exam Grading</h2>

          {writtenError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-700 text-sm">{writtenError}</p>
            </div>
          )}

          {writtenStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Select Class</label>
                <select
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={writtenClassId}
                  onChange={(e) => {
                    setWrittenClassId(e.target.value)
                    setWrittenExamId('')
                  }}
                >
                  <option value="">Choose class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {writtenClassId && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Select Exam</label>
                  <select
                    className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                    value={writtenExamId}
                    onChange={(e) => setWrittenExamId(e.target.value)}
                  >
                    <option value="">Choose exam…</option>
                    {writtenExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                  {writtenExams.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-1">No written exams for this class.</p>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!writtenClassId || !writtenExamId}
                onClick={handleStartWrittenGrading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
              >
                Start Grading
              </button>
            </div>
          )}

          {writtenSuccessToast && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-green-700 text-sm font-medium">{writtenSuccessToast}</p>
            </div>
          )}

          {writtenStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">
                {writtenSelectedExam?.name}
                {' · '}
                {classes.find((c) => c.id === writtenClassId)?.name}
              </p>

              <input
                type="text"
                value={writtenSearch}
                onChange={(e) => setWrittenSearch(e.target.value)}
                placeholder="Search by name or roll number…"
                className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#262626]"
              />

              <div className="space-y-2">
                {filteredWrittenStudents.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No students found.</p>
                )}
                {filteredWrittenStudents.map((student) => {
                  const isExpanded = expandedStudentId === student.id
                  const poorArr = writtenPoorQuestions[student.id] ?? []
                  const isGraded = gradedStudentIds.has(student.id)
                  const isSubmitted = submittedStudentIds.has(student.id)
                  const studentMarks = writtenMarks[student.id]

                  return (
                    <div key={student.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626]">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isGraded || isSubmitted) handleExpandWrittenStudent(student.id)
                          }}
                          className={`flex-1 text-left ${!isGraded || isSubmitted ? 'hover:opacity-80' : ''}`}
                        >
                          <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-sm">{student.name}</p>
                          <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Roll #{student.roll_number}</p>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSubmitted && (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700">
                              Submitted
                            </span>
                          )}
                          {isGraded && !isSubmitted && (
                            <>
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                Graded
                              </span>
                              {studentMarks !== '' && studentMarks != null && (
                                <span className="text-xs font-medium text-gray-700 dark:text-[#A8A8A8]">
                                  {studentMarks}/{writtenTotalMarks ?? '—'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenWrittenReview(student.id)}
                                className="text-xs font-medium px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
                              >
                                Review
                              </button>
                            </>
                          )}
                          {(!isGraded || isSubmitted) && (
                            <button
                              type="button"
                              onClick={() => handleExpandWrittenStudent(student.id)}
                              className="text-gray-400 dark:text-[#A8A8A8] text-xs px-1"
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && !reviewStudentId && (
                        <div className="px-4 pb-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-4">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-3">
                            <p className="text-sm text-yellow-800 font-medium">
                              Select questions with poor or wrong answers
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">
                              Marks obtained / {writtenTotalMarks ?? '—'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={writtenTotalMarks ?? undefined}
                              value={writtenMarks[student.id] ?? ''}
                              onChange={(e) =>
                                setWrittenMarks((prev) => ({
                                  ...prev,
                                  [student.id]: e.target.value,
                                }))
                              }
                              placeholder={writtenTotalMarks ? `0 – ${writtenTotalMarks}` : 'Set total marks on exam'}
                              className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#262626]"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: writtenQuestionCount }, (_, i) => i + 1).map((qNum) => {
                              const isPoor = poorArr.includes(qNum)
                              return (
                                <button
                                  key={qNum}
                                  type="button"
                                  onClick={() => toggleWrittenPoorQuestion(student.id, qNum)}
                                  className={`w-10 h-10 rounded-lg border-2 text-xs font-medium transition-colors ${
                                    isPoor
                                      ? 'border-red-500 bg-red-100 text-red-800'
                                      : 'border-green-500 bg-green-100 text-green-800'
                                  }`}
                                >
                                  {qNum}
                                </button>
                              )
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveWrittenStudent(student.id)}
                            disabled={writtenSavingId === student.id}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
                          >
                            {writtenSavingId === student.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {gradedStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmAllWrittenStudents}
                  disabled={writtenConfirmingAll}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
                >
                  {writtenConfirmingAll ? 'Notifying…' : 'Confirm & Notify All'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setWrittenStep(1)}
                className="text-sm text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]"
              >
                ← Change class / exam
              </button>
            </div>
          )}

          {reviewStudentId && (() => {
            const reviewStudent = writtenStudents.find((s) => s.id === reviewStudentId)
            const review = buildWrittenReviewData(reviewStudentId)
            if (!reviewStudent) return null

            return (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto relative">
                  <button
                    type="button"
                    onClick={() => setReviewStudentId(null)}
                    className="absolute top-4 right-4 text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg leading-none"
                    aria-label="Close review"
                  >
                    ✕
                  </button>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] mb-1 pr-8">Review Grading</h3>
                  <p className="text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">
                    {reviewStudent.name} · Roll #{reviewStudent.roll_number}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mb-4">{writtenSelectedExam?.name}</p>

                  <div className="bg-gray-50 dark:bg-[#262626] rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">Marks obtained</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">
                      {review.marks}/{writtenTotalMarks ?? '—'}
                    </p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Good answers (green)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {review.good.map((qNum) => (
                        <span
                          key={qNum}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-green-500 bg-green-100 text-green-800 text-xs font-medium"
                        >
                          {qNum}
                        </span>
                      ))}
                      {review.good.length === 0 && (
                        <span className="text-xs text-gray-400 dark:text-[#A8A8A8]">None</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Poor / wrong answers (red)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {review.poor.map((qNum) => (
                        <span
                          key={qNum}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-red-500 bg-red-100 text-red-800 text-xs font-medium"
                        >
                          {qNum}
                        </span>
                      ))}
                      {review.poor.length === 0 && (
                        <span className="text-xs text-gray-400 dark:text-[#A8A8A8]">None</span>
                      )}
                    </div>
                  </div>

                  {Object.keys(review.topicPoorMap).length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Topics needing improvement</p>
                      <ul className="space-y-2">
                        {Object.entries(review.topicPoorMap).map(([topic, qNums]) => (
                          <li
                            key={topic}
                            className="text-sm border border-orange-100 bg-orange-50 rounded-lg px-3 py-2"
                          >
                            <span className="font-medium text-orange-800">{topic}</span>
                            <span className="text-orange-600 text-xs ml-2">
                              Q{qNums.sort((a, b) => a - b).join(', Q')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditFromReview(reviewStudentId)}
                      className="flex-1 border-2 border-gray-300 dark:border-gray-600 bg-white text-gray-700 hover:shadow-md transition-shadow dark:text-[#A8A8A8] py-2.5 rounded-xl text-sm font-medium dark:bg-[#262626]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmWrittenStudent(reviewStudentId)}
                      disabled={writtenSavingId === reviewStudentId}
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                    >
                      {writtenSavingId === reviewStudentId ? 'Sending…' : 'Confirm & Notify'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </section>
      )}

      {showScanUI && gradingMode === 'omr' && (
        <button
          type="button"
          onClick={() => setGradingMode(null)}
          className="text-sm text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8] mb-4"
        >
          ← Back
        </button>
      )}

      {showScanUI && gradingMode === 'omr' && step === 1 && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">Step 1 — Select Exam</h2>
          <label className="block text-sm text-gray-600 dark:text-[#A8A8A8]">Exam</label>
          <select
            className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            <option value="">Choose an exam…</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          {selectedExam && (
            <div className="bg-blue-50 border border-blue-100 dark:border-gray-600 rounded-lg p-4 text-sm">
              <p className="font-medium text-gray-900 dark:text-[#FFFFFF] truncate max-w-[200px] md:max-w-none">{selectedExam.name}</p>
              <p className="text-gray-600 dark:text-[#A8A8A8]">
                Total questions: {selectedExam.total_questions ?? DEFAULT_QUESTION_COUNT}
              </p>
            </div>
          )}
          <button
            type="button"
            disabled={!examId}
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
          >
            Start Scanning
          </button>
        </section>
      )}

      {showScanUI && gradingMode === 'omr' && step === 2 && !showReview && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">Step 2 — Select Student + Scan</h2>
            {sessionRecords.length > 0 && (
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-sm text-blue-600 font-medium"
              >
                Complete Session ({sessionRecords.length} scanned)
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">
            Exam:{' '}
            <span className="font-medium text-gray-800 dark:text-[#FFFFFF] truncate max-w-[200px] md:max-w-none inline-block align-bottom">
              {selectedExam?.name}
            </span>
          </p>

          <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-[#262626] rounded-xl p-1 mb-4">
            {[
              { id: 'class', label: '📋 Class' },
              { id: 'rollscan', label: '🔢 Roll No' },
              { id: 'absent', label: '❌ Absent' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScanTab(tab.id)}
                className={`py-2 text-xs font-medium rounded-lg transition-colors text-center ${
                  scanTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {scanTab === 'class' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Select Class</label>
                <select
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setRollNumber('')
                    setStudentId('')
                    setStudentName('')
                  }}
                >
                  <option value="">Choose class…</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Enter Roll Number</label>
                <input
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 101"
                />
                {studentName && (
                  <p className="mt-1 text-sm text-green-700 font-medium">{studentName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">Or select student</label>
                <select
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={studentId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                >
                  <option value="">Choose student…</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.roll_number} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                disabled={!studentId || scanning}
                onClick={() => fileRef.current?.click()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-40"
              >
                📷 Take Photo / Upload OMR
              </button>

              <p className="text-xs text-gray-500 dark:text-[#A8A8A8] text-center mt-2">
                💡 Tip: Place the OMR sheet on a dark surface for best scanning accuracy
              </p>

              {scanning && <Spinner />}
              {savedFlash && (
                <p className="text-center text-green-700 font-semibold">Saved! ✓</p>
              )}
              {scanError && <p className="text-sm text-red-600">{scanError}</p>}

              {sessionRecords.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">
                    Scanned: {sessionRecords.length}
                  </p>
                  <ul className="space-y-1">
                    {sessionRecords.map((r, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm gap-2">
                        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-[#A8A8A8]">{r.studentName}</span>
                        <span className="shrink-0 text-xs font-medium text-green-700">{r.score}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sessionRecords.length > 0 && selectedClassId && !showReview && (
                <button
                  type="button"
                  onClick={handleOpenReview}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium mt-3"
                >
                  Review Class & Post Results ({sessionRecords.length} scanned)
                </button>
              )}
            </>
          )}

          {scanTab === 'rollscan' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">
                  Enter Roll Number
                </label>
                <input
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={rollScanRoll}
                  onChange={(e) => setRollScanRoll(e.target.value)}
                  placeholder="e.g. 007"
                />
                {rollScanStudentName && (
                  <p
                    className={`mt-1 text-sm font-medium ${
                      rollScanStudentId ? 'text-green-700' : 'text-red-500'
                    }`}
                  >
                    {rollScanStudentName}
                  </p>
                )}
              </div>

              <input
                ref={fileRefRoll}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileForRoll}
              />
              <button
                type="button"
                disabled={!rollScanStudentId || scanning}
                onClick={() => fileRefRoll.current?.click()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-40"
              >
                📷 Upload OMR Photo
              </button>

              {scanning && <Spinner />}
              {scanError && <p className="text-sm text-red-600">{scanError}</p>}

              {rollScanRecords.length > 0 && (
                <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-[#A8A8A8]">
                      Scanned: {rollScanRecords.length} students
                    </p>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
                    {rollScanRecords.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 text-sm border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-[#FFFFFF] flex-1 min-w-0 truncate">
                          {r.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-[#A8A8A8] shrink-0 ml-2">
                          Roll #{r.roll}
                        </span>
                        <span className="text-xs font-medium text-green-600 shrink-0 ml-2">
                          {r.score}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handlePostRollResults}
                    disabled={postingResults}
                    className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-40"
                  >
                    {postingResults
                      ? 'Posting...'
                      : `Post Results & Notify ${rollScanRecords.length} Students`}
                  </button>
                </div>
              )}
            </div>
          )}

          {scanTab === 'absent' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-[#A8A8A8] mb-1">
                  Enter Roll Number
                </label>
                <input
                  className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-[#262626]"
                  value={absentRoll}
                  onChange={(e) => setAbsentRoll(e.target.value)}
                  placeholder="e.g. 007"
                />
                {absentStudentName && (
                  <p
                    className={`mt-1 text-sm font-medium ${
                      absentStudentId ? 'text-green-700' : 'text-red-500'
                    }`}
                  >
                    {absentStudentName}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={
                  !absentStudentId ||
                  absentList.some((s) => s.id === absentStudentId)
                }
                onClick={() => {
                  setAbsentList((prev) => [
                    ...prev,
                    {
                      id: absentStudentId,
                      name: absentStudentName,
                      roll: absentRoll,
                    },
                  ])
                  setAbsentRoll('')
                  setAbsentStudentId('')
                  setAbsentStudentName('')
                }}
                className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
              >
                ❌ Mark Absent
              </button>

              {absentList.length > 0 && (
                <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">
                    Marked Absent: {absentList.length}
                  </p>
                  <ul className="space-y-1 mb-3">
                    {absentList.map((s, i) => (
                      <li key={i} className="flex items-center justify-between text-sm py-1">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-[#FFFFFF]">{s.name}</span>
                          <span className="text-gray-400 dark:text-[#A8A8A8] ml-2">Roll #{s.roll}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAbsentList((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="text-xs text-gray-400 dark:text-[#A8A8A8] hover:text-red-500"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={handleConfirmAbsent}
                    disabled={postingResults}
                    className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    {postingResults
                      ? 'Saving...'
                      : `Confirm & Notify ${absentList.length} Absent Students`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {showScanUI && gradingMode === 'omr' && step === 2 && showReview && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">
              Review & Post Results
            </h2>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="text-sm text-gray-500 dark:text-[#A8A8A8]"
            >
              ← Back
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">
            Scanned: {sessionRecords.length} · Not scanned:{' '}
            {reviewStudents.filter(
              (s) => !sessionRecords.find((r) => r.studentId === s.id)
            ).length}
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {reviewStudents.map((student) => {
              const scanned = sessionRecords.find((r) => r.studentId === student.id)
              const isAbsent = absentStudentIds.has(student.id)

              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between min-h-[52px] py-2 border-b border-gray-50 last:border-0 gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#FFFFFF] truncate">{student.name}</p>
                    <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">Roll #{student.roll_number}</p>
                  </div>
                  {scanned ? (
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-3 py-2 rounded-lg font-medium min-w-[44px] text-center">
                      ✅ {scanned.score}%
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAbsentStudentIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(student.id)) next.delete(student.id)
                          else next.add(student.id)
                          return next
                        })
                      }}
                      className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-medium min-w-[44px] transition-colors ${
                        isAbsent
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : 'bg-gray-100 dark:bg-[#262626] text-gray-500 dark:text-[#A8A8A8] border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isAbsent ? '❌ Absent' : 'Mark Absent'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handlePostResults}
            disabled={postingResults}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
          >
            {postingResults ? 'Posting...' : 'Post Results & Notify Students'}
          </button>
        </section>
      )}

      {showScanUI && gradingMode === 'omr' && step === 3 && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">Step 3 — Review Detected Answers</h2>
          <p className="text-sm text-gray-600 dark:text-[#A8A8A8]">
            Student: {selectedStudent?.name ?? studentName} · Confidence:{' '}
            <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">
              {confidence != null ? `${Math.round(confidence * 100)}%` : '—'}
            </span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-96 overflow-y-auto">
            {Array.from({ length: questionCount }, (_, i) => i + 1).map((n) => {
              const val = answers[n] ?? ''
              const ambiguous = ambiguousSet.has(n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    const idx = ANSWERS.indexOf(val)
                    const next = idx < 0 ? 'A' : ANSWERS[(idx + 1) % ANSWERS.length]
                    setManualAnswer(n, ambiguous && !val ? 'A' : next)
                  }}
                  className={`text-left px-2 py-2 rounded-lg border text-sm ${
                    ambiguous
                      ? 'border-red-400 bg-red-50 text-red-800'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626]'
                  }`}
                >
                  Q{n} → {val || '—'}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Click a question to cycle A → B → C → D</p>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmSave}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetStudentFields()
                setStep(2)
              }}
              className="flex-1 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] py-2.5 rounded-lg font-medium hover:shadow-md transition-shadow"
            >
              Rescan
            </button>
          </div>
          {scanError && <p className="text-sm text-red-600">{scanError}</p>}
        </section>
      )}

      {showScanUI && gradingMode === 'omr' && step === 4 && sessionSummary && (
        <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-[#FFFFFF]">Session Summary</h2>
          <p className="text-gray-700 dark:text-[#A8A8A8]">
            Students scanned: <strong>{sessionSummary.count}</strong>
          </p>
          <p className="text-gray-700 dark:text-[#A8A8A8]">
            Average score: <strong>{Math.round(sessionSummary.avg)}%</strong>
          </p>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-[#FFFFFF] mb-2">Topic-wise class performance</h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-[#A8A8A8]">
              {Object.entries(sessionSummary.topicAgg).map(([tid, { score, total }]) => (
                <li key={tid}>
                  Topic {tid}: {Math.round((score / total) * 100)}% ({score}/{total})
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/"
            className="block text-center w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium"
          >
            View Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] py-2.5 rounded-lg text-sm hover:shadow-md transition-shadow"
          >
            Continue scanning
          </button>
        </section>
      )}

    </div>
  )
}
