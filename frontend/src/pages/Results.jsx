import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom'
import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../supabase'

function topicStatus(pct) {
  if (pct >= 75) return 'strong'
  if (pct >= 50) return 'average'
  return 'weak'
}

const statusBarClass = {
  strong: 'bg-green-500',
  average: 'bg-yellow-400',
  weak: 'bg-red-500',
}

const statusPillClass = {
  strong: 'bg-green-100 text-green-700',
  average: 'bg-yellow-100 text-yellow-700',
  weak: 'bg-red-100 text-red-700',
}

function OverallScoreCard({ result }) {
  const { totalScore, totalMax, percentage, classTop } = result
  const youPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0
  const topPct = totalMax > 0 ? (classTop / totalMax) * 100 : 0
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Overall Score</p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl md:text-4xl font-bold text-green-600 whitespace-nowrap">{totalScore} / {totalMax}</span>
            <span className="text-lg font-medium text-gray-500">({percentage}%)</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">Class Top</p>
          <p className="text-lg font-semibold text-gray-900">{classTop}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="relative h-2.5 w-[70%] overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${youPct}%` }} />
        </div>
        <div className="flex w-[30%] flex-col gap-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
            You {Math.round(youPct)}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-900 shrink-0" />
            Top {Math.round(topPct)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function SubjectTabs({ subjects, active, onChange }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex min-w-max gap-1 border-b border-gray-200 px-1">
        {subjects.map((s) => {
          const isActive = s.subject_id === active
          return (
            <button key={s.subject_id} type="button" onClick={() => onChange(s.subject_id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>
              {s.name}
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-green-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TopicPerformance({ subject }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Topic Performance</h2>
      <div className="mt-4 flex flex-col gap-4">
        {subject.topics.map((t) => {
          const status = topicStatus(t.percentage)
          return (
            <div key={t.name}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.score} / {t.total} questions</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass[status]}`}>{t.percentage}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${statusBarClass[status]}`} style={{ width: `${t.percentage}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopicSummary({ subject }) {
  const strong = subject.topics.filter((t) => t.percentage >= 60)
  const weak = subject.topics.filter((t) => t.percentage < 60)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-green-700">
          <ArrowUp className="h-4 w-4" />Strong Topics
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {strong.length === 0 && <li className="text-sm text-gray-500">No topics above 60% yet.</li>}
          {strong.map((t) => (
            <li key={t.name} className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className="font-semibold text-green-700">{t.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600">
          <ArrowDown className="h-4 w-4" />Needs Improvement
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {weak.length === 0 && <li className="text-sm text-gray-500">Great — nothing below 60%!</li>}
          {weak.map((t) => (
            <li key={t.name} className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className="font-semibold text-red-600">{t.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TrendIcon({ first, last }) {
  const diff = last - first
  if (diff > 5) return <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><ArrowUp className="h-3 w-3" />+{diff}%</span>
  if (diff < -5) return <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><ArrowDown className="h-3 w-3" />{diff}%</span>
  return <span className="flex items-center gap-1 text-gray-400 text-xs font-medium"><Minus className="h-3 w-3" />Stable</span>
}

function PerformanceTrend({ trendData, totalExams }) {
  const [expandedSubjects, setExpandedSubjects] = useState({})
  function toggleSubject(sid) {
    setExpandedSubjects((prev) => ({ ...prev, [sid]: !prev[sid] }))
  }
  if (!trendData || trendData.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Performance Trend</h2>
        <p className="text-xs text-gray-500 mt-0.5">Across all {totalExams} exams — click a subject to see topic breakdown</p>
      </div>
      <div className="flex flex-col gap-2">
        {trendData.map((subject) => {
          const isExpanded = expandedSubjects[subject.subject_id]
          const status = topicStatus(subject.avgPct)
          return (
            <div key={subject.subject_id} className="rounded-xl border border-gray-100 overflow-hidden">
              <button type="button" onClick={() => toggleSubject(subject.subject_id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                  <span className="font-semibold text-gray-900 text-sm">{subject.name}</span>
                  <span className="text-xs text-gray-400">{subject.examCount} / {totalExams} exams</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TrendIcon first={subject.firstPct} last={subject.lastPct} />
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass[status]}`}>avg {subject.avgPct}%</span>
                </div>
              </button>
              {isExpanded && (
                <div className="divide-y divide-gray-50">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white">
                    <div className="col-span-4 text-xs font-medium text-gray-400">Topic</div>
                    <div className="col-span-4 text-xs font-medium text-gray-400">Coverage</div>
                    <div className="col-span-2 text-xs font-medium text-gray-400 text-center">Avg</div>
                    <div className="col-span-2 text-xs font-medium text-gray-400 text-center">Trend</div>
                  </div>
                  {subject.topics.map((topic) => {
                    const tStatus = topicStatus(topic.avgPct)
                    const fillPct = Math.round((topic.examCount / totalExams) * 100)
                    return (
                      <div key={topic.name} className="grid grid-cols-12 gap-2 px-4 py-3 bg-white items-center">
                        <div className="col-span-4">
                          <p className="text-sm font-medium text-gray-900">{topic.name}</p>
                          <p className="text-xs text-gray-400">{topic.examCount}/{totalExams} exams</p>
                        </div>
                        <div className="col-span-4">
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400" style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass[tStatus]}`}>{topic.avgPct}%</span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <TrendIcon first={topic.firstPct} last={topic.lastPct} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClassHeatmap({ examId, exams }) {
  const [subjectId, setSubjectId] = useState('')
  const [examSubjects, setExamSubjects] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!examId) return
    supabase
      .from('exam_subjects')
      .select('subject_id, question_from, question_to, subjects(name)')
      .eq('exam_id', examId)
      .then(({ data }) => {
        if (data) {
          setExamSubjects(data)
          if (data.length > 0) setSubjectId(data[0].subject_id)
        }
      })
  }, [examId])

  useEffect(() => {
    if (!examId || !subjectId) return
    setLoading(true)
    supabase
      .from('topic_scores')
      .select('student_id, topic_id, percentage, topics(name), users(name, roll_number)')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .then(({ data }) => {
        if (!data || data.length === 0) { setHeatmapData([]); setLoading(false); return }

        const studentMap = {}
        const topicSet = {}

        for (const row of data) {
          const sid = row.student_id
          const tname = row.topics?.name ?? 'Unknown'
          const sname = row.users?.name ?? 'Unknown'
          const roll = row.users?.roll_number ?? ''

          if (!studentMap[sid]) studentMap[sid] = { name: sname, roll, topics: {} }
          studentMap[sid].topics[tname] = row.percentage
          topicSet[tname] = true
        }

        const topics = Object.keys(topicSet).sort()
        const students = Object.values(studentMap).sort((a, b) => a.roll - b.roll)

        setHeatmapData({ topics, students })
        setLoading(false)
      })
  }, [examId, subjectId])

  function cellColor(pct) {
    if (pct === undefined) return 'bg-gray-100 text-gray-400'
    if (pct >= 75) return 'bg-green-100 text-green-700'
    if (pct >= 50) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Subject</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-600">
          {examSubjects.map((es) => (
            <option key={es.subject_id} value={es.subject_id}>{es.subjects?.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading heatmap…</p>}

      {!loading && heatmapData.students?.length === 0 && (
        <p className="text-sm text-gray-500">No data found for this exam and subject.</p>
      )}

      {!loading && heatmapData.topics && heatmapData.students?.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Student</th>
                {heatmapData.topics.map((t) => (
                  <th key={t} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">{t}</th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">Avg</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.students.map((student, i) => {
                const scores = heatmapData.topics.map((t) => student.topics[t])
                const validScores = scores.filter((s) => s !== undefined)
                const avg = validScores.length > 0
                  ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                  : 0
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <p className="font-medium text-gray-900 text-xs">{student.name}</p>
                      <p className="text-xs text-gray-400">#{student.roll}</p>
                    </td>
                    {scores.map((pct, j) => (
                      <td key={j} className="px-3 py-2.5 text-center">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${cellColor(pct)}`}>
                          {pct !== undefined ? `${pct}%` : '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${cellColor(avg)}`}>
                        {avg}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50">Class Avg</td>
                {heatmapData.topics.map((t) => {
                  const vals = heatmapData.students.map((s) => s.topics[t]).filter((v) => v !== undefined)
                  const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
                  return (
                    <td key={t} className="px-3 py-2.5 text-center">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${cellColor(avg)}`}>{avg}%</span>
                    </td>
                  )
                })}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Results() {
  const { session } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state
  const fromStudentsNav = !!navState?.studentName
  const [userRole, setUserRole] = useState('student')
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState(navState?.examId ?? '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeSubject, setActiveSubject] = useState('')
  const [trendData, setTrendData] = useState([])
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [activeTab, setActiveTab] = useState(navState?.tab ?? 'student')
  const [selectedStudentId, setSelectedStudentId] = useState(navState?.studentId ?? '')
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(navState?.classId ?? '')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentRankings, setStudentRankings] = useState([])
  const [expandedStudentId, setExpandedStudentId] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.role) setUserRole(data.role)
      })
  }, [session])

  useEffect(() => {
    if (!examId || !isTeacher || !session?.user?.id) {
      setStudentRankings([])
      return
    }

    async function fetchRankings() {
      const { data: examClassData } = await supabase
        .from('exam_classes')
        .select('class_id, classes(id, name)')
        .eq('exam_id', examId)

      let allStudents = []

      if (!examClassData || examClassData.length === 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('institute_id')
          .eq('id', session.user.id)
          .single()

        const { data: students } = await supabase
          .from('users')
          .select('id, name, roll_number, class_id, classes(name)')
          .eq('role', 'student')
          .eq('institute_id', userData?.institute_id)
          .order('roll_number')

        allStudents = students ?? []
      } else {
        const classIds = examClassData.map((ec) => ec.class_id)
        const { data: students } = await supabase
          .from('users')
          .select('id, name, roll_number, class_id, classes(name)')
          .eq('role', 'student')
          .in('class_id', classIds)
          .order('roll_number')

        allStudents = students ?? []
      }

      if (allStudents.length === 0) {
        setStudentRankings([])
        return
      }

      const { data: scores } = await supabase
        .from('omr_results')
        .select('student_id, is_correct')
        .eq('exam_id', examId)
        .in('student_id', allStudents.map((s) => s.id))

      const { data: examData } = await supabase
        .from('exams')
        .select('total_questions')
        .eq('id', examId)
        .single()

      const totalQ = examData?.total_questions ?? 0

      const scoreMap = {}
      for (const r of scores ?? []) {
        if (!scoreMap[r.student_id]) scoreMap[r.student_id] = 0
        if (r.is_correct) scoreMap[r.student_id] += 1
      }

      const rankings = allStudents.map((s) => ({
        ...s,
        score: scoreMap[s.id] ?? 0,
        totalQ,
        attended: s.id in scoreMap,
      }))

      rankings.sort((a, b) => {
        if (a.attended && !b.attended) return -1
        if (!a.attended && b.attended) return 1
        return b.score - a.score
      })

      setStudentRankings(rankings)
    }

    fetchRankings()
  }, [examId, isTeacher, session])

  useEffect(() => {
    if (!isTeacher || !examId || !session?.user?.id) return

    setClasses([])
    supabase
      .from('exam_classes')
      .select('class_id, classes(id, name)')
      .eq('exam_id', examId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setClasses(data.map((ec) => ec.classes).filter(Boolean))
        } else {
          supabase
            .from('users')
            .select('institute_id')
            .eq('id', session.user.id)
            .single()
            .then(({ data: userData }) => {
              if (userData?.institute_id) {
                supabase
                  .from('classes')
                  .select('id, name')
                  .eq('institute_id', userData.institute_id)
                  .then(({ data: classData }) => {
                    if (classData) setClasses(classData)
                  })
              }
            })
        }
      })
  }, [examId, isTeacher, session])

  useEffect(() => {
    if (fromStudentsNav) {
      setStudentSearch('')
      return
    }
    setSelectedClassId('')
    setSelectedStudentId('')
    setExpandedStudentId(null)
    setStudentSearch('')
  }, [examId, fromStudentsNav])

  useEffect(() => {
    supabase
      .from('exams')
      .select('id, name, exam_subjects(subject_id, subjects(name))')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setExams(data)
          if (!navState?.examId) {
            setExamId(data[0].id)
          }
        }
      })
  }, [])

  useEffect(() => {
    if (!examId) return
    if (isTeacher && !selectedStudentId) {
      setResult(null)
      setLoading(false)
      return
    }
    if (!isTeacher && !session?.user?.id) return

    async function loadResults() {
      setLoading(true)
      let query = supabase
        .from('topic_scores')
        .select('topic_id, subject_id, score, total, percentage, topics(name), subjects(name)')
        .eq('exam_id', examId)

      if (isTeacher) {
        query = query.eq('student_id', selectedStudentId)
      } else {
        query = query.eq('student_id', session.user.id)
      }

      const { data } = await query
      if (!data || data.length === 0) { setResult(null); setLoading(false); return }

      const subjectMap = {}
      for (const row of data) {
        const sid = row.subject_id ?? 'unknown'
        if (!subjectMap[sid]) {
          subjectMap[sid] = { subject_id: sid, name: row.subjects?.name ?? 'General', score: 0, max: 0, percentage: 0, topics: [] }
        }
        subjectMap[sid].topics.push({ name: row.topics?.name ?? 'Unknown', score: row.score, total: row.total, percentage: row.percentage })
        subjectMap[sid].score += row.score
        subjectMap[sid].max += row.total
      }
      const subjects = Object.values(subjectMap).map((s) => ({ ...s, percentage: s.max > 0 ? Math.round((s.score / s.max) * 100) : 0 }))
      const totalScore = subjects.reduce((sum, s) => sum + s.score, 0)
      const totalMax = subjects.reduce((sum, s) => sum + s.max, 0)
      const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
      const newResult = { totalScore, totalMax, percentage, classTop: 0, subjects }

      const { data: allScores } = await supabase
        .from('topic_scores')
        .select('student_id, score')
        .eq('exam_id', examId)

      if (allScores && allScores.length > 0) {
        const studentTotals = {}
        for (const row of allScores) {
          if (!studentTotals[row.student_id]) studentTotals[row.student_id] = 0
          studentTotals[row.student_id] += row.score
        }
        const maxScore = Math.max(...Object.values(studentTotals))
        newResult.classTop = maxScore
      }

      setResult(newResult)
      if (subjects.length > 0) setActiveSubject(subjects[0].subject_id)
      setLoading(false)
    }

    loadResults()
  }, [examId, isTeacher, selectedStudentId, session])

  useEffect(() => {
    if (exams.length === 0) return
    if (isTeacher && !selectedStudentId) {
      setTrendData([])
      return
    }
    if (!isTeacher && !session?.user?.id) return

    setLoadingTrend(true)
    let query = supabase
      .from('topic_scores')
      .select('exam_id, topic_id, subject_id, score, total, percentage, topics(name), subjects(name), exams(exam_date)')
      .in('exam_id', exams.map((e) => e.id))

    if (isTeacher) {
      query = query.eq('student_id', selectedStudentId)
    } else {
      query = query.eq('student_id', session.user.id)
    }

    query.then(({ data }) => {
        if (!data || data.length === 0) { setLoadingTrend(false); return }
        const subjectMap = {}
        for (const row of data) {
          const sid = row.subject_id ?? 'unknown'
          const sname = row.subjects?.name ?? 'General'
          const tname = row.topics?.name ?? 'Unknown'
          const examDate = row.exams?.exam_date ?? ''
          if (!subjectMap[sid]) subjectMap[sid] = { subject_id: sid, name: sname, topicMap: {}, appearances: [] }
          if (!subjectMap[sid].appearances.find((a) => a.examId === row.exam_id)) {
            subjectMap[sid].appearances.push({ examId: row.exam_id, percentage: row.percentage, date: examDate })
          }
          if (!subjectMap[sid].topicMap[tname]) subjectMap[sid].topicMap[tname] = { name: tname, appearances: [] }
          subjectMap[sid].topicMap[tname].appearances.push({ examId: row.exam_id, percentage: row.percentage, date: examDate })
        }
        const trend = Object.values(subjectMap).map((subject) => {
          const sorted = subject.appearances.sort((a, b) => a.date.localeCompare(b.date))
          const allPcts = sorted.map((a) => a.percentage)
          const avgPct = allPcts.length > 0 ? Math.round(allPcts.reduce((s, v) => s + v, 0) / allPcts.length) : 0
          const topics = Object.values(subject.topicMap).map((topic) => {
            const tSorted = topic.appearances.sort((a, b) => a.date.localeCompare(b.date))
            const tPcts = tSorted.map((a) => a.percentage)
            const tAvg = tPcts.length > 0 ? Math.round(tPcts.reduce((s, v) => s + v, 0) / tPcts.length) : 0
            return { name: topic.name, examCount: tSorted.length, avgPct: tAvg, firstPct: tPcts[0] ?? 0, lastPct: tPcts[tPcts.length - 1] ?? 0 }
          })
          return { subject_id: subject.subject_id, name: subject.name, examCount: sorted.length, avgPct, firstPct: allPcts[0] ?? 0, lastPct: allPcts[allPcts.length - 1] ?? 0, topics }
        })
        setTrendData(trend)
        setLoadingTrend(false)
      })
  }, [exams, isTeacher, selectedStudentId, session])

  const subject = result?.subjects?.find((s) => s.subject_id === activeSubject) ?? result?.subjects?.[0]

  const displayedRankings = selectedClassId
    ? studentRankings.filter((s) => s.class_id === selectedClassId)
    : studentRankings

  const searchedRankings = displayedRankings.filter((s) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    String(s.roll_number).includes(studentSearch)
  )

  const showTeacherPerformance = isTeacher && activeTab === 'student' && (
    fromStudentsNav ? selectedStudentId : expandedStudentId
  )

  function renderPerformanceDashboard() {
    return (
      <>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading results…</span>
          </div>
        )}
        {!loading && !result && examId && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No results found for this exam yet.</p>
            <p className="text-gray-400 text-xs mt-1">Scan some OMR sheets first.</p>
          </div>
        )}
        {!loading && result && subject && (
          <>
            <OverallScoreCard result={result} />
            <div className="flex flex-col gap-5">
              <SubjectTabs subjects={result.subjects} active={subject.subject_id} onChange={setActiveSubject} />
              <TopicPerformance subject={subject} />
              <TopicSummary subject={subject} />
            </div>
          </>
        )}
        {!loadingTrend && trendData.length > 0 && (
          <PerformanceTrend trendData={trendData} totalExams={exams.length} />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {navState?.studentName && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-700 font-medium">
              Viewing results for: {navState.studentName}
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ← Back to Students
            </button>
          </div>
        )}

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">EduPulse</p>
            <h1 className="text-2xl font-bold text-gray-900">My Performance</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={examId} onChange={(e) => setExamId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-green-500">
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            {isTeacher && activeTab === 'student' && classes.length > 0 && !navState?.classId && (
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  setSelectedStudentId('')
                  setExpandedStudentId(null)
                  setStudentSearch('')
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        </header>

        {isTeacher && (
          <div className="flex gap-1 border-b border-gray-200 mb-5">
            <button onClick={() => setActiveTab('student')}
              className={`px-4 py-2.5 text-sm font-medium relative ${activeTab === 'student' ? 'text-gray-900' : 'text-gray-500'}`}>
              Student Performance
              {activeTab === 'student' && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />}
            </button>
            <button onClick={() => setActiveTab('heatmap')}
              className={`px-4 py-2.5 text-sm font-medium relative ${activeTab === 'heatmap' ? 'text-gray-900' : 'text-gray-500'}`}>
              Class Heatmap
              {activeTab === 'heatmap' && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />}
            </button>
          </div>
        )}

        {isTeacher && activeTab === 'heatmap' && (
          <ClassHeatmap examId={examId} exams={exams} />
        )}

        {fromStudentsNav && showTeacherPerformance && renderPerformanceDashboard()}

        {isTeacher && activeTab === 'student' && examId && !fromStudentsNav && displayedRankings.length === 0 && studentRankings.length > 0 && selectedClassId && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No students in this class</p>
          </div>
        )}

        {isTeacher && activeTab === 'student' && examId && !fromStudentsNav && studentRankings.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No students found for this exam</p>
          </div>
        )}

        {!isTeacher && loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading results…</span>
          </div>
        )}

        {!isTeacher && !loading && !result && examId && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No results found for this exam yet.</p>
            <p className="text-gray-400 text-xs mt-1">Scan some OMR sheets first.</p>
          </div>
        )}

        {!isTeacher && !loading && result && subject && (
          <>
            <OverallScoreCard result={result} />
            <div className="flex flex-col gap-5">
              <SubjectTabs subjects={result.subjects} active={subject.subject_id} onChange={setActiveSubject} />
              <TopicPerformance subject={subject} />
              <TopicSummary subject={subject} />
            </div>
          </>
        )}

        {!isTeacher && !loadingTrend && trendData.length > 0 && (
          <PerformanceTrend trendData={trendData} totalExams={exams.length} />
        )}

        {isTeacher && activeTab === 'student' && examId && !fromStudentsNav && (
          <>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {displayedRankings.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Class Results — {displayedRankings.length} students
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {searchedRankings.map((s) => {
                    const index = displayedRankings.indexOf(s)
                    return (
                      <div key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedStudentId((prev) => (prev === s.id ? null : s.id))
                            setSelectedStudentId(s.id)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                            expandedStudentId === s.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              !s.attended
                                ? 'bg-gray-100 text-gray-400'
                                : index === 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : index === 1
                                    ? 'bg-gray-100 text-gray-600'
                                    : index === 2
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {s.attended ? index + 1 : '—'}
                          </span>

                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                            <p className="text-xs text-gray-400">
                              Roll #{s.roll_number}
                              {!selectedClassId && s.classes?.name && ` · ${s.classes.name}`}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            {s.attended ? (
                              <>
                                <p className="font-semibold text-gray-900 text-sm">
                                  {s.score} / {s.totalQ}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {s.totalQ > 0 ? Math.round((s.score / s.totalQ) * 100) : 0}%
                                </p>
                              </>
                            ) : (
                              <div>
                                <p className="font-semibold text-gray-500 text-sm">0 / {s.totalQ}</p>
                                <p className="text-xs text-red-400">Absent</p>
                              </div>
                            )}
                          </div>
                        </button>

                        {expandedStudentId === s.id && loading && (
                          <div className="flex items-center justify-center py-8 mx-4 mb-4">
                            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                            <span className="ml-3 text-sm text-gray-500">Loading results…</span>
                          </div>
                        )}

                        {expandedStudentId === s.id && !loading && !result && examId && (
                          <div className="mx-4 mb-4 rounded-xl border border-gray-200 bg-white p-6 text-center">
                            <p className="text-gray-500 text-sm">No results found for this exam yet.</p>
                            <p className="text-gray-400 text-xs mt-1">Scan some OMR sheets first.</p>
                          </div>
                        )}

                        {expandedStudentId === s.id && !loading && result && subject && (
                          <div className="mx-4 mb-4 border border-blue-100 rounded-xl overflow-hidden bg-white">
                            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                              <p className="text-xs font-medium text-blue-700">
                                {s.name}&apos;s Performance
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedStudentId(null)
                                  setSelectedStudentId('')
                                }}
                                className="text-blue-400 hover:text-blue-600 text-sm"
                              >
                                ✕ Close
                              </button>
                            </div>
                            <div className="p-4 flex flex-col gap-4">
                              <OverallScoreCard result={result} />
                              <SubjectTabs
                                subjects={result.subjects}
                                active={subject.subject_id}
                                onChange={setActiveSubject}
                              />
                              <TopicPerformance subject={subject} />
                              <TopicSummary subject={subject} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {searchedRankings.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No students found matching &quot;{studentSearch}&quot;
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
