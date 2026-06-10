import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabase'

const API_URL = import.meta.env.VITE_API_URL
const ANSWERS = ['A', 'B', 'C', 'D']
const DEFAULT_QUESTION_COUNT = 50

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 text-blue-600">
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Scanning OMR…</span>
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
  const [absentWarning, setAbsentWarning] = useState(null)
  const [activeScanMode, setActiveScanMode] = useState('class')
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

    query.single().then(({ data }) => {
      if (data) {
        setRollScanStudentId(data.id)
        setRollScanStudentName(data.name)
      } else {
        setRollScanStudentId('')
        setRollScanStudentName('Student not found')
      }
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

    query.single().then(({ data }) => {
      if (data) {
        setAbsentStudentId(data.id)
        setAbsentStudentName(data.name)
      } else {
        setAbsentStudentId('')
        setAbsentStudentName('Student not found')
      }
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
    const file = e.target.files?.[0]
    if (!file) return

    const alreadyAbsent = absentList.some((s) => s.id === studentId)
    if (alreadyAbsent) {
      setAbsentWarning({
        studentId,
        studentName,
        pendingFile: file,
      })
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    await processFile(file, { mode: 'class' })
  }

  const handleFileForRoll = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const alreadyAbsent = absentList.some((s) => s.id === rollScanStudentId)
    if (alreadyAbsent) {
      setAbsentWarning({
        studentId: rollScanStudentId,
        studentName: rollScanStudentName,
        pendingFile: file,
      })
      if (fileRefRoll.current) fileRefRoll.current.value = ''
      return
    }

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

      const topicRows = Object.entries(topicMap).map(([topic_id, { score, total, subject_id }]) => ({
        exam_id: selectedExam.id,
        student_id: studentId,
        topic_id,
        subject_id: subject_id ?? null,
        score,
        total,
        percentage: total > 0 ? Math.round((score / total) * 100) : 0,
      }))

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
      const allStudentIds = reviewStudents.map((s) => s.id)

      const notifRows = allStudentIds.map((id) => ({
        user_id: id,
        title: 'Results Posted',
        body: `Your results for ${selectedExam.name} are now available`,
        type: 'results',
        is_read: false,
      }))

      if (notifRows.length > 0) {
        const { error } = await supabase.from('notifications').insert(notifRows)
        if (error) console.log('Notification error:', error)
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
      const notifRows = rollScanRecords.map((r) => ({
        user_id: r.studentId,
        title: 'Results Posted',
        body: `Your results for ${selectedExam.name} are now available`,
        type: 'results',
        is_read: false,
      }))

      if (notifRows.length > 0) {
        const { error } = await supabase
          .from('notifications')
          .insert(notifRows)

        if (error) console.log('Notification error:', error)
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

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">OMR Scanning</h1>

      {userRole === 'student' && (
        <p className="text-sm text-red-600">Scanning is only available to teachers and admins.</p>
      )}

      {showScanUI && step === 1 && (
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Step 1 — Select Exam</h2>
          <label className="block text-sm text-gray-600">Exam</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
              <p className="font-medium text-gray-900 truncate max-w-[200px] md:max-w-none">{selectedExam.name}</p>
              <p className="text-gray-600">
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

      {showScanUI && step === 2 && !showReview && (
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Step 2 — Select Student + Scan</h2>
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
          <p className="text-sm text-gray-500">
            Exam:{' '}
            <span className="font-medium text-gray-800 truncate max-w-[200px] md:max-w-none inline-block align-bottom">
              {selectedExam?.name}
            </span>
          </p>

          <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1 mb-4">
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
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {scanTab === 'class' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Class</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <label className="block text-sm text-gray-600 mb-1">Enter Roll Number</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 101"
                />
                {studentName && (
                  <p className="mt-1 text-sm text-green-700 font-medium">{studentName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Or select student</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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

              <p className="text-xs text-gray-500 text-center mt-2">
                💡 Tip: Place the OMR sheet on a dark surface for best scanning accuracy
              </p>

              {scanning && <Spinner />}
              {savedFlash && (
                <p className="text-center text-green-700 font-semibold">Saved! ✓</p>
              )}
              {scanError && <p className="text-sm text-red-600">{scanError}</p>}

              {sessionRecords.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Scanned: {sessionRecords.length}
                  </p>
                  <ul className="space-y-1">
                    {sessionRecords.map((r, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm gap-2">
                        <span className="flex-1 min-w-0 truncate text-gray-700">{r.studentName}</span>
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
                <label className="block text-sm text-gray-600 mb-1">
                  Enter Roll Number
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">
                      Scanned: {rollScanRecords.length} students
                    </p>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
                    {rollScanRecords.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 text-sm border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">
                          {r.name}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">
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
                <label className="block text-sm text-gray-600 mb-1">
                  Enter Roll Number
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Marked Absent: {absentList.length}
                  </p>
                  <ul className="space-y-1 mb-3">
                    {absentList.map((s, i) => (
                      <li key={i} className="flex items-center justify-between text-sm py-1">
                        <div>
                          <span className="font-medium text-gray-900">{s.name}</span>
                          <span className="text-gray-400 ml-2">Roll #{s.roll}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAbsentList((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="text-xs text-gray-400 hover:text-red-500"
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

      {showScanUI && step === 2 && showReview && (
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Review & Post Results
            </h2>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="text-sm text-gray-500"
            >
              ← Back
            </button>
          </div>

          <p className="text-sm text-gray-600">
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
                    <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                    <p className="text-xs text-gray-400">Roll #{student.roll_number}</p>
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
                          : 'bg-gray-100 text-gray-500 border-gray-300'
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

      {showScanUI && step === 3 && (
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Step 3 — Review Detected Answers</h2>
          <p className="text-sm text-gray-600">
            Student: {selectedStudent?.name ?? studentName} · Confidence:{' '}
            <span className="font-semibold text-gray-900">
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
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  Q{n} → {val || '—'}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500">Click a question to cycle A → B → C → D</p>

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
              className="flex-1 border border-gray-300 py-2.5 rounded-lg font-medium"
            >
              Rescan
            </button>
          </div>
          {scanError && <p className="text-sm text-red-600">{scanError}</p>}
        </section>
      )}

      {showScanUI && step === 4 && sessionSummary && (
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Session Summary</h2>
          <p className="text-gray-700">
            Students scanned: <strong>{sessionSummary.count}</strong>
          </p>
          <p className="text-gray-700">
            Average score: <strong>{Math.round(sessionSummary.avg)}%</strong>
          </p>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Topic-wise class performance</h3>
            <ul className="space-y-1 text-sm text-gray-600">
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
            className="w-full border border-gray-300 py-2.5 rounded-lg text-sm"
          >
            Continue scanning
          </button>
        </section>
      )}

      {absentWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-semibold text-gray-900">
                Student Marked Absent
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{absentWarning.studentName}</span>
              {' '}was already marked absent for this exam.
              Are you sure you want to scan their OMR sheet?
              This will remove them from the absent list.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const { studentId: sid, studentName: sname, pendingFile } = absentWarning
                  setAbsentList((prev) => prev.filter((s) => s.id !== sid))
                  const mode = scanTab === 'rollscan' ? 'rollscan' : 'class'
                  if (mode === 'rollscan') {
                    setRollScanStudentId(sid)
                    setRollScanStudentName(sname)
                  } else {
                    setStudentId(sid)
                    setStudentName(sname)
                  }
                  await processFile(pendingFile, { studentId: sid, mode })
                  setAbsentWarning(null)
                }}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                Continue Scan
              </button>
              <button
                type="button"
                onClick={() => setAbsentWarning(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
