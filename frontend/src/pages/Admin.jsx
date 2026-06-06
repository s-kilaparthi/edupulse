import { Fragment, useEffect, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

function topicBadgeClass(pct) {
  if (pct >= 75) return 'bg-green-100 text-green-700'
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function topicBarClass(pct) {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-400'
  return 'bg-red-500'
}

export default function Admin() {
  const { session } = useOutletContext()
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)

  const [studentCount, setStudentCount] = useState(0)
  const [teacherCount, setTeacherCount] = useState(0)
  const [examCount, setExamCount] = useState(0)
  const [instituteAvg, setInstituteAvg] = useState(0)

  const [subjects, setSubjects] = useState([])
  const [subjectAvgs, setSubjectAvgs] = useState({})
  const [expandedSubject, setExpandedSubject] = useState(null)
  const [topicData, setTopicData] = useState({})
  const [loadingTopics, setLoadingTopics] = useState(null)

  const [recentExams, setRecentExams] = useState([])
  const [examStats, setExamStats] = useState({})

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.role) setRole(data.role)
      })
      .finally(() => setLoadingRole(false))
  }, [session])

  useEffect(() => {
    if (role !== 'admin') return

    async function loadStats() {
      const [studentsRes, teachersRes, examsRes, scoresRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('exams').select('*', { count: 'exact', head: true }),
        supabase.from('topic_scores').select('percentage'),
      ])

      setStudentCount(studentsRes.count ?? 0)
      setTeacherCount(teachersRes.count ?? 0)
      setExamCount(examsRes.count ?? 0)

      const pcts = (scoresRes.data ?? []).map((r) => r.percentage).filter((p) => p != null)
      setInstituteAvg(pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0)
    }

    loadStats()
  }, [role])

  useEffect(() => {
    if (role !== 'admin') return

    async function loadSubjects() {
      const { data: subjectRows } = await supabase
        .from('subjects')
        .select('id, name, teacher_id, users(name)')
        .order('name')

      setSubjects(subjectRows ?? [])

      const { data: scores } = await supabase.from('topic_scores').select('subject_id, percentage')
      const totals = {}
      const counts = {}
      for (const row of scores ?? []) {
        if (!row.subject_id) continue
        totals[row.subject_id] = (totals[row.subject_id] ?? 0) + row.percentage
        counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1
      }
      const avgs = {}
      for (const sid of Object.keys(totals)) {
        avgs[sid] = Math.round(totals[sid] / counts[sid])
      }
      setSubjectAvgs(avgs)
    }

    loadSubjects()
  }, [role])

  useEffect(() => {
    if (role !== 'admin') return

    async function loadRecentExams() {
      const { data: exams } = await supabase
        .from('exams')
        .select('id, name, exam_date, total_questions')
        .order('exam_date', { ascending: false })
        .limit(10)

      setRecentExams(exams ?? [])
      if (!exams?.length) return

      const examIds = exams.map((e) => e.id)
      const [omrRes, scoresRes] = await Promise.all([
        supabase.from('omr_results').select('exam_id, student_id').in('exam_id', examIds),
        supabase.from('topic_scores').select('exam_id, percentage').in('exam_id', examIds),
      ])

      const scanned = {}
      for (const row of omrRes.data ?? []) {
        if (!scanned[row.exam_id]) scanned[row.exam_id] = new Set()
        scanned[row.exam_id].add(row.student_id)
      }

      const avgTotals = {}
      const avgCounts = {}
      for (const row of scoresRes.data ?? []) {
        avgTotals[row.exam_id] = (avgTotals[row.exam_id] ?? 0) + row.percentage
        avgCounts[row.exam_id] = (avgCounts[row.exam_id] ?? 0) + 1
      }

      const stats = {}
      for (const exam of exams) {
        stats[exam.id] = {
          scanned: scanned[exam.id]?.size ?? 0,
          avg: avgCounts[exam.id]
            ? Math.round(avgTotals[exam.id] / avgCounts[exam.id])
            : 0,
        }
      }
      setExamStats(stats)
    }

    loadRecentExams()
  }, [role])

  async function toggleTopics(subjectId) {
    if (expandedSubject === subjectId) {
      setExpandedSubject(null)
      return
    }

    setExpandedSubject(subjectId)

    if (topicData[subjectId]) return

    setLoadingTopics(subjectId)
    const { data } = await supabase
      .from('topic_scores')
      .select('topic_id, percentage, topics(name)')
      .eq('subject_id', subjectId)

    const topicMap = {}
    for (const row of data ?? []) {
      const tid = row.topic_id
      const name = row.topics?.name ?? 'Unknown'
      if (!topicMap[tid]) topicMap[tid] = { name, pcts: [] }
      topicMap[tid].pcts.push(row.percentage)
    }

    const topics = Object.values(topicMap)
      .map((t) => ({
        name: t.name,
        avg: Math.round(t.pcts.reduce((a, b) => a + b, 0) / t.pcts.length),
      }))
      .sort((a, b) => b.avg - a.avg)

    setTopicData((prev) => ({ ...prev, [subjectId]: topics }))
    setLoadingTopics(null)
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">EduPulse</p>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: studentCount },
          { label: 'Total Teachers', value: teacherCount },
          { label: 'Total Exams', value: examCount },
          { label: 'Institute Avg', value: `${instituteAvg}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subject Performance</h2>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Teacher</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Avg Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Topics</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No subjects found.</td>
                </tr>
              )}
              {subjects.map((subject) => {
                const avg = subjectAvgs[subject.id]
                const isExpanded = expandedSubject === subject.id
                const topics = topicData[subject.id] ?? []
                return (
                  <Fragment key={subject.id}>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{subject.name}</td>
                      <td className="px-4 py-3 text-gray-600">{subject.users?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {avg != null ? (
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${topicBadgeClass(avg)}`}>
                            {avg}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleTopics(subject.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? 'Hide Topics ▲' : 'Show Topics ▼'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="px-4 py-4">
                          {loadingTopics === subject.id && (
                            <p className="text-sm text-gray-500">Loading topics…</p>
                          )}
                          {loadingTopics !== subject.id && topics.length === 0 && (
                            <p className="text-sm text-gray-500">No topic data yet.</p>
                          )}
                          {topics.length > 0 && (
                            <div className="flex flex-col gap-3">
                              {topics.map((topic) => (
                                <div key={topic.name} className="flex items-center gap-4">
                                  <span className="w-40 shrink-0 text-sm font-medium text-gray-900">{topic.name}</span>
                                  <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${topicBarClass(topic.avg)}`}
                                      style={{ width: `${topic.avg}%` }}
                                    />
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${topicBadgeClass(topic.avg)}`}>
                                    {topic.avg}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Exams</h2>
        {recentExams.length === 0 ? (
          <p className="text-sm text-gray-500">No exams found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentExams.map((exam) => {
              const stats = examStats[exam.id] ?? { scanned: 0, avg: 0 }
              const date = exam.exam_date
                ? new Date(exam.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'
              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate('/results', { state: { examId: exam.id, tab: 'heatmap' } })}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left"
                    >
                      {exam.name}
                    </button>
                    <p className="text-xs text-gray-500 mt-0.5">{date} · {exam.total_questions ?? '—'} questions</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Scanned</p>
                      <p className="font-bold text-gray-900">{stats.scanned}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Avg Score</p>
                      <p className="font-bold text-gray-900">{stats.avg}%</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
