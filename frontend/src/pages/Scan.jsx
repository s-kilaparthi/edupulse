import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const fileRef = useRef(null)

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

  useEffect(() => {
    async function loadExamsAndClasses() {
      const { data, error } = await supabase
        .from('exams')
        .select('id, name, total_questions, scope, exam_classes(class_id, classes(name))')
        .order('name')
      if (!error && data) setExams(data)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', user.id)
        .single()

      if (userData?.institute_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', userData.institute_id)
          .order('name')
        if (classData) setClasses(classData)
      }
    }
    loadExamsAndClasses()
  }, [])

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, roll_number, class_id')
      .eq('role', 'student')
      .order('roll_number')
      .then(({ data, error }) => {
        if (!error && data) setStudents(data)
      })
  }, [])

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

  async function processFile(file) {
    if (!file || !selectedExam || !studentId) {
      setScanError('Select exam and student before uploading.')
      return
    }
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
    await processFile(e.target.files?.[0])
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

      setSessionRecords((prev) => [
        ...prev,
        {
          studentId,
          studentName: selectedStudent?.name ?? studentName,
          score: pct,
          topicMap,
        },
      ])

      setSavedFlash(true)
      setTimeout(() => {
        setSavedFlash(false)
        resetStudentFields()
        setStep(2)
      }, 1200)
    } catch (err) {
      setScanError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
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

      {step === 1 && (
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
              <p className="font-medium text-gray-900">{selectedExam.name}</p>
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

      {step === 2 && (
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
            Exam: <span className="font-medium text-gray-800">{selectedExam?.name}</span>
          </p>

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
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-40"
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
        </section>
      )}

      {step === 3 && (
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

      {step === 4 && sessionSummary && (
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
    </div>
  )
}
