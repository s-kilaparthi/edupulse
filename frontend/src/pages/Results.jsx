import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom'
import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../supabase'
import { fetchTeacherClassesAndGroups } from '../utils/teacherGroups'
import Loader from '../components/Loader'

function topicStatus(pct) {
  if (pct >= 80) return 'strong'
  if (pct >= 60) return 'average'
  return 'weak'
}

function topicScoreDisplayName(row) {
  const chapterName = row.chapters?.name ?? 'Unknown Chapter'
  const topicName = row.topics?.name ?? null
  return topicName ? `${chapterName} → ${topicName}` : chapterName
}

function TopicDisplayName({ name }) {
  const arrowIdx = name.indexOf(' → ')
  if (arrowIdx === -1) {
    return <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">{name}</span>
  }
  const chapterName = name.slice(0, arrowIdx)
  const topicName = name.slice(arrowIdx + 3)
  return (
    <span>
      <span className="text-gray-500 dark:text-[#A8A8A8]">{chapterName}</span>
      <span className="text-gray-500 dark:text-[#A8A8A8]"> → </span>
      <span className="font-semibold text-gray-900 dark:text-[#FFFFFF]">{topicName}</span>
    </span>
  )
}

const statusBarClass = {
  strong: 'bg-green-500',
  average: 'bg-yellow-400',
  weak: 'bg-red-500',
}

const statusLabel = {
  strong: 'Strong',
  average: 'Mid',
  weak: 'Low',
}

const statusPillClass = {
  strong: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  average: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  weak: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
}

function ExamTypeBadge({ examType }) {
  const isWritten = examType === 'written'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium text-white border border-current ${
        isWritten ? 'bg-blue-600' : 'bg-purple-600'
      }`}
    >
      {isWritten ? 'Written' : 'MCQ'}
    </span>
  )
}

function InstituteExamTypeBadge({ name }) {
  if (!name) return null
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium border border-current border border-current">
      {name}
    </span>
  )
}

function formatExamDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function OverallScoreCard({ result }) {
  const { totalScore, totalMax, percentage, classTop, notGraded } = result

  if (notGraded) {
    return (
      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Overall Score</p>
        <p className="mt-1 text-lg font-medium text-gray-500 dark:text-[#A8A8A8]">Not graded</p>
      </div>
    )
  }

  const youPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0
  const topPct = totalMax > 0 ? (classTop / totalMax) * 100 : 0
  return (
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">Overall Score</p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl md:text-4xl font-bold text-green-600 whitespace-nowrap">{totalScore} / {totalMax}</span>
            <span className="text-lg font-medium text-gray-500 dark:text-[#A8A8A8]">({percentage}%)</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Class Top</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF]">{classTop}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="relative h-2.5 w-[70%] overflow-hidden rounded-full bg-gray-100 dark:bg-[#262626]">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${youPct}%` }} />
        </div>
        <div className="flex w-[30%] flex-col gap-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-[#A8A8A8]">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
            You {Math.round(youPct)}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-[#A8A8A8]">
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
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 border-b border-gray-200 dark:border-gray-700">
        {subjects.map((s) => {
          const isActive = s.subject_id === active
          return (
            <button key={s.subject_id} type="button" onClick={() => onChange(s.subject_id)}
              className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8] hover:text-gray-900 dark:text-[#FFFFFF]'}`}>
              {s.name}
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-green-500" />}
            </button>
          )
        })}
    </div>
  )
}

function TopicPerformance({ subject }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Topic Performance</h2>
      <div className="mt-4 flex flex-col gap-4">
        {subject.topics.map((t) => {
          const status = topicStatus(t.percentage)
          return (
            <div key={t.name}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-gray-900 dark:text-[#FFFFFF]"><TopicDisplayName name={t.name} /></p>
                  <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">{t.score} / {t.total} questions</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass[status]}`}>
                  {statusLabel[status]} · {t.percentage}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#262626]">
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
  const strong = subject.topics.filter((t) => t.percentage >= 80)
  const average = subject.topics.filter((t) => t.percentage >= 60 && t.percentage < 80)
  const weak = subject.topics.filter((t) => t.percentage < 60)
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl border-2 border-green-200 bg-green-50 dark:bg-green-900/20 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
          <ArrowUp className="h-4 w-4" />Strong Topics
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {strong.length === 0 && <li className="text-sm text-gray-500 dark:text-[#A8A8A8]">No topics at 80% or above yet.</li>}
          {strong.map((t) => (
            <li key={t.name} className="flex items-center justify-between text-sm">
              <TopicDisplayName name={t.name} />
              <span className="font-semibold text-green-700 dark:text-green-300">{t.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-300">
          <Minus className="h-4 w-4" />Average Topics
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {average.length === 0 && <li className="text-sm text-gray-500 dark:text-[#A8A8A8]">No topics in the 60–79% range.</li>}
          {average.map((t) => (
            <li key={t.name} className="flex items-center justify-between text-sm">
              <TopicDisplayName name={t.name} />
              <span className="font-semibold text-yellow-700 dark:text-yellow-300">{t.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-900/20 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
          <ArrowDown className="h-4 w-4" />Needs Improvement
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {weak.length === 0 && <li className="text-sm text-gray-500 dark:text-[#A8A8A8]">Great — nothing below 60%!</li>}
          {weak.map((t) => (
            <li key={t.name} className="flex items-center justify-between text-sm">
              <TopicDisplayName name={t.name} />
              <span className="font-semibold text-red-700 dark:text-red-300">{t.percentage}%</span>
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
  return <span className="flex items-center gap-1 text-gray-400 dark:text-[#A8A8A8] text-xs font-medium"><Minus className="h-3 w-3" />Stable</span>
}

function PerformanceTrend({ trendData, totalExams }) {
  const [expandedSubjects, setExpandedSubjects] = useState({})
  function toggleSubject(sid) {
    setExpandedSubjects((prev) => ({ ...prev, [sid]: !prev[sid] }))
  }
  if (!trendData || trendData.length === 0) return null
  return (
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Performance Trend</h2>
        <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-0.5">Across all {totalExams} exams — click a subject to see topic breakdown</p>
      </div>
      <div className="flex flex-col gap-2">
        {trendData.map((subject) => {
          const isExpanded = expandedSubjects[subject.subject_id]
          const status = topicStatus(subject.avgPct)
          return (
            <div key={subject.subject_id} className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => toggleSubject(subject.subject_id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-[#262626] hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#A8A8A8] shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#A8A8A8] shrink-0" />}
                  <span className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">{subject.name}</span>
                  <span className="text-xs text-gray-400 dark:text-[#A8A8A8]">{subject.examCount} / {totalExams} exams</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TrendIcon first={subject.firstPct} last={subject.lastPct} />
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass[status]}`}>avg {subject.avgPct}%</span>
                </div>
              </button>
              {isExpanded && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white dark:bg-[#1C1C1C]">
                    <div className="col-span-4 text-xs font-medium text-gray-400 dark:text-[#A8A8A8]">Topic</div>
                    <div className="col-span-4 text-xs font-medium text-gray-400 dark:text-[#A8A8A8]">Coverage</div>
                    <div className="col-span-2 text-xs font-medium text-gray-400 dark:text-[#A8A8A8] text-center">Avg</div>
                    <div className="col-span-2 text-xs font-medium text-gray-400 dark:text-[#A8A8A8] text-center">Trend</div>
                  </div>
                  {subject.topics.map((topic) => {
                    const tStatus = topicStatus(topic.avgPct)
                    const fillPct = Math.round((topic.examCount / totalExams) * 100)
                    return (
                      <div key={topic.name} className="grid grid-cols-12 gap-2 px-4 py-3 bg-white dark:bg-[#1C1C1C] items-center">
                        <div className="col-span-4">
                          <p className="text-sm text-gray-900 dark:text-[#FFFFFF]"><TopicDisplayName name={topic.name} /></p>
                          <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">{topic.examCount}/{totalExams} exams</p>
                        </div>
                        <div className="col-span-4">
                          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-[#262626] overflow-hidden">
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

function heatmapPctClass(pct) {
  if (pct >= 70) return 'text-green-600 dark:text-green-400'
  if (pct >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function performancePctClass(pct) {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function reportsRankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-100 text-yellow-800'
  if (rank === 2) return 'bg-gray-200 text-gray-700 dark:bg-[#363636] dark:text-[#A8A8A8]'
  if (rank === 3) return 'bg-orange-100 text-orange-800'
  return 'bg-gray-50 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8]'
}

function reportsRankLabel(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

const SECTION_ACCENT_COLORS = [
  'border-l-blue-500',
  'border-l-green-500',
  'border-l-orange-500',
  'border-l-purple-500',
]

function extractGroupClasses(group) {
  const members = group?.class_group_members ?? []
  return members
    .map((m) => {
      const cls = m.classes
      if (!cls) return null
      return { id: m.class_id ?? cls.id, name: cls.name }
    })
    .filter(Boolean)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

function filterClassesByGroup(allClasses, groupId, classGroups) {
  if (!groupId) return allClasses
  const group = classGroups.find((g) => g.id === groupId)
  const groupClassIds = new Set(extractGroupClasses(group).map((c) => c.id))
  return allClasses.filter((c) => groupClassIds.has(c.id))
}

function isExamVisibleToTeacher(exam, teacherId) {
  if (!exam || !teacherId) return false
  if (exam.created_by === teacherId) return true
  return (exam.exam_teachers ?? []).some((et) => et.teacher_id === teacherId)
}

async function aggregateSubjectScores(examIds, subjectId, studentIds) {
  if (!examIds.length || !subjectId || !studentIds.length) return {}

  const { data } = await supabase
    .from('topic_scores')
    .select('student_id, score, total')
    .in('exam_id', examIds)
    .eq('subject_id', subjectId)
    .in('student_id', studentIds)

  const agg = {}
  for (const sid of studentIds) {
    agg[sid] = { obtained: 0, total: 0 }
  }
  for (const row of data ?? []) {
    if (!agg[row.student_id]) agg[row.student_id] = { obtained: 0, total: 0 }
    agg[row.student_id].obtained += row.score ?? 0
    agg[row.student_id].total += row.total ?? 0
  }
  return agg
}

const REPORT_SELECT_CLASS =
  'w-full sm:w-auto min-w-[160px] rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none'

const REPORT_FILTER_ROW_CLASS = 'flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full'
const REPORT_FILTER_ITEM_CLASS = 'flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto'

function ClassBadge({ name }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] font-medium border border-current">
      {name}
    </span>
  )
}

function ReportRankingsTable({ rankings, onStudentClick, showClassBadge = false }) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-[#262626]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Student Name</th>
            {showClassBadge && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Class</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Roll No</th>
            {!showClassBadge && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Class</th>
            )}
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Marks</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Total</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((s, index) => {
            const rank = index + 1
            return (
              <tr key={s.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262626]">
                <td className="px-4 py-3">
                  <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold ${reportsRankBadgeClass(rank)}`}>
                    {reportsRankLabel(rank)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onStudentClick(s)}
                    className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                  >
                    {s.name}
                  </button>
                </td>
                {showClassBadge && (
                  <td className="px-4 py-3">
                    <ClassBadge name={s.className} />
                  </td>
                )}
                <td className="px-4 py-3 text-gray-700 dark:text-[#A8A8A8]">{s.roll_number}</td>
                {!showClassBadge && (
                  <td className="px-4 py-3 text-gray-700 dark:text-[#A8A8A8]">{s.className}</td>
                )}
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-[#FFFFFF]">{s.score}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-[#A8A8A8]">{s.total}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${heatmapPctClass(s.percentage)}`}>
                    {s.mode === 'aggregate' ? `${s.percentage}% avg` : `${s.percentage}%`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReportRankingsMobile({ rankings, onStudentClick, showClassBadge = false }) {
  return (
    <div className="md:hidden flex flex-col gap-3">
      {rankings.map((s, index) => {
        const rank = index + 1
        return (
          <div
            key={s.id}
            className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              <span className={`inline-flex w-9 h-9 items-center justify-center rounded-full text-sm font-bold shrink-0 ${reportsRankBadgeClass(rank)}`}>
                {reportsRankLabel(rank)}
              </span>
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onStudentClick(s)}
                  className="font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left truncate block w-full"
                >
                  {s.name}
                </button>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">Roll #{s.roll_number}</p>
                  {showClassBadge ? <ClassBadge name={s.className} /> : (
                    <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">· {s.className}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mt-2">
                  {s.score} / {s.total}
                  <span className={`ml-2 ${heatmapPctClass(s.percentage)}`}>
                    {s.mode === 'aggregate' ? `${s.percentage}% avg` : `${s.percentage}%`}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StudentReportsPanel({
  classGroups,
  reportClasses,
  reportGroupClasses,
  instituteExamTypes,
  reportExams,
  reportGroupId,
  setReportGroupId,
  reportExamTypeId,
  setReportExamTypeId,
  reportExamId,
  setReportExamId,
  reportClassId,
  setReportClassId,
  reportSelectedClassIds,
  setReportSelectedClassIds,
  reportViewMode,
  setReportViewMode,
  reportSubjects,
  reportSubjectId,
  setReportSubjectId,
  showSubjectFilter,
  loadingReportRankings,
  reportRankings,
  sectionWiseRankings,
  groupOverallAvg,
  onStudentClick,
}) {
  return (
    <>
      <div className="flex flex-col gap-4">
        <div className={REPORT_FILTER_ROW_CLASS}>
          <div className={REPORT_FILTER_ITEM_CLASS}>
            <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] shrink-0">Group</label>
            <select
              value={reportGroupId}
              onChange={(e) => setReportGroupId(e.target.value)}
              className={REPORT_SELECT_CLASS}
            >
              <option value="">All Groups</option>
              {classGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className={REPORT_FILTER_ITEM_CLASS}>
            <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] shrink-0">Exam Type</label>
            <select
              value={reportExamTypeId}
              onChange={(e) => {
                setReportExamTypeId(e.target.value)
                setReportExamId('')
              }}
              className={REPORT_SELECT_CLASS}
            >
              <option value="">All Types</option>
              {instituteExamTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className={REPORT_FILTER_ITEM_CLASS}>
            <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] shrink-0">Exam Name</label>
            <select
              value={reportExamId}
              onChange={(e) => setReportExamId(e.target.value)}
              className={REPORT_SELECT_CLASS}
            >
              <option value="">All Exams</option>
              {reportExams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
          </div>
          {!reportGroupId && (
            <div className={REPORT_FILTER_ITEM_CLASS}>
              <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] shrink-0">Class</label>
              <select
                value={reportClassId}
                onChange={(e) => setReportClassId(e.target.value)}
                className={REPORT_SELECT_CLASS}
              >
                <option value="">All Classes</option>
                {reportClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {reportGroupId && reportGroupClasses.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Classes in group</p>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              {reportGroupClasses.map((cls) => {
                const checked = reportSelectedClassIds.includes(cls.id)
                return (
                  <label
                    key={cls.id}
                    className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                      checked
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setReportSelectedClassIds((prev) =>
                          checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id],
                        )
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shrink-0"
                    />
                    {cls.name}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {showSubjectFilter && reportSubjects.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Subject</p>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setReportSubjectId('')}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !reportSubjectId
                    ? 'bg-blue-500 text-white'
                    : 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                }`}
              >
                All Subjects
              </button>
              {reportSubjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setReportSubjectId(sub.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    reportSubjectId === sub.id
                      ? 'bg-blue-500 text-white'
                      : 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {reportGroupId && (
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setReportViewMode('mixed')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                reportViewMode === 'mixed'
                  ? 'bg-blue-500 text-white'
                  : 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
              }`}
            >
              Mixed Ranking
            </button>
            <button
              type="button"
              onClick={() => setReportViewMode('section')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                reportViewMode === 'section'
                  ? 'bg-blue-500 text-white'
                  : 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
              }`}
            >
              Section-wise
            </button>
          </div>
        )}
      </div>

      {loadingReportRankings && (
        <div className="flex justify-center items-center h-64">
          <Loader size={40} />
        </div>
      )}

      {!loadingReportRankings && reportRankings.length === 0 && (
        <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center">
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No graded exams found for selected filters</p>
        </div>
      )}

      {!loadingReportRankings && reportRankings.length > 0 && reportViewMode === 'mixed' && (
        <>
          <ReportRankingsTable
            rankings={reportRankings}
            showClassBadge={!!reportGroupId}
            onStudentClick={onStudentClick}
          />
          <ReportRankingsMobile
            rankings={reportRankings}
            showClassBadge={!!reportGroupId}
            onStudentClick={onStudentClick}
          />
        </>
      )}

      {!loadingReportRankings && reportRankings.length > 0 && reportGroupId && reportViewMode === 'section' && (
        <div className="flex flex-col gap-5">
          {sectionWiseRankings.map((section) => (
            <div
              key={section.classId}
              className={`rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm overflow-hidden border-l-4 ${SECTION_ACCENT_COLORS[section.accentIndex % SECTION_ACCENT_COLORS.length]}`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">{section.className}</h3>
                <span className={`text-sm font-semibold ${heatmapPctClass(section.avgPct)}`}>
                  Avg: {section.avgPct}%
                </span>
              </div>
              {section.students.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-[#A8A8A8] text-center py-6">No graded students in this class</p>
              ) : (
                <>
                  <ReportRankingsTable
                    rankings={section.students}
                    showClassBadge={false}
                    onStudentClick={onStudentClick}
                  />
                  <ReportRankingsMobile
                    rankings={section.students}
                    showClassBadge={false}
                    onStudentClick={onStudentClick}
                  />
                </>
              )}
            </div>
          ))}
          {groupOverallAvg !== null && (
            <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-6 text-center w-full">
              <p className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">
                Group Overall Avg:{' '}
                <span className={heatmapPctClass(groupOverallAvg)}>{groupOverallAvg}%</span>
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

async function computeExamTotalsForStudents(exam, examId, studentIds) {
  if (!studentIds.length) {
    return { sumObtained: 0, sumTotal: 0, percentage: 0 }
  }

  if (exam.exam_type === 'written') {
    const { data: summaries } = await supabase
      .from('omr_results')
      .select('marks_obtained, total_marks')
      .eq('exam_id', examId)
      .in('student_id', studentIds)
      .is('question_id', null)

    const sumObtained = (summaries ?? []).reduce((sum, r) => sum + (r.marks_obtained ?? 0), 0)
    const sumTotal = (summaries ?? []).reduce((sum, r) => sum + (r.total_marks ?? 0), 0)
    const percentage = sumTotal > 0 ? Math.round((sumObtained / sumTotal) * 100) : 0
    return { sumObtained, sumTotal, percentage }
  }

  const { data: mcqResults } = await supabase
    .from('omr_results')
    .select('student_id, is_correct, question_id')
    .eq('exam_id', examId)
    .in('student_id', studentIds)
    .not('question_id', 'is', null)

  const studentCorrect = {}
  const attended = new Set()
  for (const row of mcqResults ?? []) {
    if (row.question_id == null) continue
    attended.add(row.student_id)
    if (!studentCorrect[row.student_id]) studentCorrect[row.student_id] = 0
    if (row.is_correct) studentCorrect[row.student_id] += 1
  }

  let sumObtained = 0
  let sumTotal = 0
  const totalQ = exam.total_questions ?? 0
  for (const sid of attended) {
    sumObtained += studentCorrect[sid] ?? 0
    sumTotal += totalQ
  }

  const percentage = sumTotal > 0 ? Math.round((sumObtained / sumTotal) * 100) : 0
  return { sumObtained, sumTotal, percentage }
}

function ClassHeatmap({ examId, exams, session, userRole, groupId }) {
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState([])
  const [classGroups, setClassGroups] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [examSubjects, setExamSubjects] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [classAverage, setClassAverage] = useState(null)
  const [allClassesSummary, setAllClassesSummary] = useState(null)
  const [examClassIdsWithScores, setExamClassIdsWithScores] = useState(() => new Set())
  const [examClassIdsLoaded, setExamClassIdsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const visibleClasses = useMemo(
    () => filterClassesByGroup(classes, groupId, classGroups),
    [classes, groupId, classGroups],
  )

  const selectedExam = exams.find((e) => e.id === examId)
  const selectedClass = visibleClasses.find((c) => c.id === classId)
  const selectedSubject = examSubjects.find((es) => es.subject_id === subjectId)

  useEffect(() => {
    if (!session?.user?.id) return

    async function loadClassesAndGroups() {
      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      if (!userData?.institute_id) {
        setClasses([])
        setClassGroups([])
        setClassId('')
        return
      }

      if (userRole === 'admin') {
        const { data: groupsData } = await supabase
          .from('class_groups')
          .select('id, name, class_group_members(class_id, classes(id, name))')
          .eq('institute_id', userData.institute_id)
          .order('name')

        const { data } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', userData.institute_id)
          .order('name')

        setClassGroups(groupsData ?? [])
        const classList = data ?? []
        setClasses(classList)
        setClassId(classList.length === 1 ? classList[0].id : '')
        return
      }

      const { classes: teacherCls, groups } = await fetchTeacherClassesAndGroups(
        session.user.id,
        userData.institute_id
      )
      setClassGroups(groups)
      setClasses(teacherCls)
      setClassId(teacherCls.length === 1 ? teacherCls[0].id : '')
    }

    loadClassesAndGroups()
  }, [session, userRole])

  useEffect(() => {
    setClassId(visibleClasses.length === 1 ? visibleClasses[0].id : '')
  }, [groupId, visibleClasses])

  useEffect(() => {
    if (!examId) {
      setExamClassIdsWithScores(new Set())
      setExamClassIdsLoaded(false)
      return
    }

    setExamClassIdsLoaded(false)
    supabase
      .from('topic_scores')
      .select('users!inner(class_id)')
      .eq('exam_id', examId)
      .then(({ data }) => {
        setExamClassIdsWithScores(
          new Set((data ?? []).map((row) => row.users?.class_id).filter(Boolean))
        )
        setExamClassIdsLoaded(true)
      })
  }, [examId])

  useEffect(() => {
    if (!examId) return
    supabase
      .from('exam_subjects')
      .select('subject_id, question_from, question_to, subjects(name)')
      .eq('exam_id', examId)
      .then(({ data }) => {
        if (data) {
          setExamSubjects(data)
          if (data.length === 1) {
            setSubjectId(data[0].subject_id)
          } else if (data.length > 0) {
            setSubjectId(data[0].subject_id)
          } else {
            setSubjectId('')
          }
        }
      })
  }, [examId])

  useEffect(() => {
    if (!examId || !subjectId || !examClassIdsLoaded) return
    setLoading(true)
    supabase
      .from('topic_scores')
      .select('student_id, topic_id, chapter_id, percentage, topics(name), chapters(name), users(name, roll_number, class_id)')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .then(({ data }) => {
        if (!data || data.length === 0) { setHeatmapData([]); setLoading(false); return }

        const studentMap = {}
        const topicSet = {}
        const scopeClassIds = groupId
          ? new Set(visibleClasses.map((c) => c.id))
          : null

        for (const row of data) {
          const studentClassId = row.users?.class_id
          if (!studentClassId || !examClassIdsWithScores.has(studentClassId)) continue
          if (classId && studentClassId !== classId) continue
          if (!classId && scopeClassIds && !scopeClassIds.has(studentClassId)) continue

          const sid = row.student_id
          const tname = row.topics?.name
            ? `${row.chapters?.name ?? 'Unknown'} → ${row.topics.name}`
            : (row.chapters?.name ?? 'Unknown')
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
  }, [examId, subjectId, classId, groupId, visibleClasses, examClassIdsWithScores, examClassIdsLoaded])

  useEffect(() => {
    if (!classId || !examId) {
      setClassAverage(null)
      return
    }

    const exam = exams.find((e) => e.id === examId)
    if (!exam) {
      setClassAverage(null)
      return
    }

    async function loadClassAverage() {
      const { data: classStudents } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'student')
        .eq('class_id', classId)

      const studentIds = (classStudents ?? []).map((s) => s.id)
      const totals = await computeExamTotalsForStudents(exam, examId, studentIds)
      setClassAverage(totals)
    }

    loadClassAverage()
  }, [classId, examId, exams])

  useEffect(() => {
    if (classId || !examId || visibleClasses.length === 0 || !examClassIdsLoaded) {
      setAllClassesSummary(null)
      return
    }

    const exam = exams.find((e) => e.id === examId)
    if (!exam) {
      setAllClassesSummary(null)
      return
    }

    async function loadAllClassesSummary() {
      const classSummaries = []
      let instituteObtained = 0
      let instituteTotal = 0

      for (const cls of visibleClasses) {
        if (!examClassIdsWithScores.has(cls.id)) continue

        const { data: classStudents } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'student')
          .eq('class_id', cls.id)

        const studentIds = (classStudents ?? []).map((s) => s.id)
        const totals = await computeExamTotalsForStudents(exam, examId, studentIds)

        classSummaries.push({
          classId: cls.id,
          className: cls.name,
          percentage: totals.percentage,
        })
        instituteObtained += totals.sumObtained
        instituteTotal += totals.sumTotal
      }

      const institutePercentage = instituteTotal > 0
        ? Math.round((instituteObtained / instituteTotal) * 100)
        : 0

      setAllClassesSummary({
        classes: classSummaries,
        institutePercentage,
        isGroupScope: !!groupId,
      })
    }

    loadAllClassesSummary()
  }, [classId, examId, exams, visibleClasses, groupId, examClassIdsWithScores, examClassIdsLoaded])

  function cellColor(pct) {
    if (pct === undefined) return 'bg-gray-100 dark:bg-[#262626] text-gray-400 dark:text-[#A8A8A8]'
    if (pct >= 75) return 'bg-green-100 text-green-700'
    if (pct >= 50) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8]">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Classes</option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8]">Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none">
            {examSubjects.map((es) => (
              <option key={es.subject_id} value={es.subject_id}>{es.subjects?.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!classId && allClassesSummary && (
        <div className="flex flex-col gap-3">
          {groupId && (
            <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 text-center">
              <p className="text-base font-semibold text-gray-900 dark:text-[#FFFFFF]">
                {classGroups.find((g) => g.id === groupId)?.name ?? 'Group'} Average:{' '}
                <span className={heatmapPctClass(allClassesSummary.institutePercentage)}>
                  {allClassesSummary.institutePercentage}%
                </span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allClassesSummary.classes.map((c) => (
              <div
                key={c.classId}
                className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-3 text-center"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-[#FFFFFF]">
                  {c.className} ·{' '}
                  <span className={`font-semibold ${heatmapPctClass(c.percentage)}`}>{c.percentage}%</span>
                </p>
              </div>
            ))}
          </div>
          {!groupId && (
            <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 text-center">
              <p className="text-base font-semibold text-gray-900 dark:text-[#FFFFFF]">
                Institute Average:{' '}
                <span className={heatmapPctClass(allClassesSummary.institutePercentage)}>
                  {allClassesSummary.institutePercentage}%
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {classId && classAverage && selectedExam && (
        <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
            {selectedClass?.name ?? 'Class'} · {selectedExam.name} · {selectedSubject?.subjects?.name ?? 'Subject'}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-[#A8A8A8]">
            Class Average: {classAverage.sumObtained} / {classAverage.sumTotal}{' '}
            <span className={`font-semibold ${heatmapPctClass(classAverage.percentage)}`}>
              ({classAverage.percentage}%)
            </span>
          </p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center h-64">
          <Loader size={40} />
        </div>
      )}

      {!loading && heatmapData.students?.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No data found for this exam and subject.</p>
      )}

      {!loading && heatmapData.topics && heatmapData.students?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#262626]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#A8A8A8] sticky left-0 bg-gray-50 dark:bg-[#262626]">Student</th>
                {heatmapData.topics.map((t) => (
                  <th key={t} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-[#A8A8A8] whitespace-nowrap">{t}</th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-[#A8A8A8]">Avg</th>
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
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262626]">
                    <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-[#1C1C1C]">
                      <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-xs">{student.name}</p>
                      <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">#{student.roll}</p>
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
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626]">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-[#A8A8A8] sticky left-0 bg-gray-50 dark:bg-[#262626]">Class Avg</td>
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
  const [userRole, setUserRole] = useState('')
  const [roleLoaded, setRoleLoaded] = useState(false)
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [allExams, setAllExams] = useState([])
  const [instituteExamTypes, setInstituteExamTypes] = useState([])
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('')
  const [examId, setExamId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [examSummaries, setExamSummaries] = useState([])
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [activeSubject, setActiveSubject] = useState('')
  const [trendData, setTrendData] = useState([])
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [activeTab, setActiveTab] = useState(navState?.tab ?? 'student')
  const [selectedStudentId, setSelectedStudentId] = useState(fromStudentsNav ? (navState?.studentId ?? '') : '')
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentRankings, setStudentRankings] = useState([])
  const [expandedStudentId, setExpandedStudentId] = useState(null)
  const [expandedStudentExamId, setExpandedStudentExamId] = useState(null)
  const [performanceStudents, setPerformanceStudents] = useState([])
  const [loadingPerformanceStudents, setLoadingPerformanceStudents] = useState(false)
  const [loadingStudentRankings, setLoadingStudentRankings] = useState(false)
  const [studentExamCards, setStudentExamCards] = useState([])
  const [loadingStudentExamCards, setLoadingStudentExamCards] = useState(false)
  const [linkedStudentId, setLinkedStudentId] = useState(null)
  const [linkedStudentClassId, setLinkedStudentClassId] = useState(null)
  const [studentClassId, setStudentClassId] = useState(null)
  const [reportExamTypeId, setReportExamTypeId] = useState('')
  const [reportExamId, setReportExamId] = useState('')
  const [reportClassId, setReportClassId] = useState('')
  const [reportRankings, setReportRankings] = useState([])
  const [loadingReportRankings, setLoadingReportRankings] = useState(false)
  const [reportsStudentId, setReportsStudentId] = useState('')
  const [reportsStudentName, setReportsStudentName] = useState('')
  const [reportViewExamId, setReportViewExamId] = useState('')
  const [classGroups, setClassGroups] = useState([])
  const [reportGroupId, setReportGroupId] = useState(navState?.groupId ?? '')
  const [reportSelectedClassIds, setReportSelectedClassIds] = useState([])
  const [reportViewMode, setReportViewMode] = useState('mixed')
  const [studentGroupId, setStudentGroupId] = useState('')
  const [heatmapGroupId, setHeatmapGroupId] = useState('')
  const [teacherClasses, setTeacherClasses] = useState([])
  const [teacherClassGroups, setTeacherClassGroups] = useState([])
  const [reportSubjectId, setReportSubjectId] = useState('')

  const effectiveStudentId =
    userRole === 'parent'
      ? linkedStudentId
      : userRole === 'student'
        ? session?.user?.id
        : null

  const exams = useMemo(() => {
    let list = allExams

    if (selectedExamTypeId) {
      list = list.filter((e) => e.exam_type_id === selectedExamTypeId)
    }

    return list
  }, [allExams, selectedExamTypeId])

  const heatmapClassGroups = userRole === 'teacher' ? teacherClassGroups : classGroups

  const heatmapExams = useMemo(() => {
    let list = exams

    if (heatmapGroupId) {
      const group = heatmapClassGroups.find((g) => g.id === heatmapGroupId)
      const groupClassIds = new Set(extractGroupClasses(group).map((c) => c.id))
      if (!groupClassIds.size) return []
      list = list.filter((exam) =>
        (exam.exam_classes ?? []).some((ec) => groupClassIds.has(ec.class_id))
      )
    }

    return list
  }, [exams, heatmapGroupId, heatmapClassGroups])

  const studentClassGroups = userRole === 'teacher' ? teacherClassGroups : classGroups

  const studentPerformanceExams = useMemo(() => {
    let list = exams

    if (studentGroupId) {
      const group = studentClassGroups.find((g) => g.id === studentGroupId)
      const groupClassIds = new Set(extractGroupClasses(group).map((c) => c.id))
      if (!groupClassIds.size) return []
      list = list.filter((exam) =>
        (exam.exam_classes ?? []).some((ec) => groupClassIds.has(ec.class_id))
      )
    }

    return list
  }, [exams, studentGroupId, studentClassGroups])

  const isStudentView = userRole === 'student' && roleLoaded
  const isParentView = userRole === 'parent' && roleLoaded
  const isLearnerView = isStudentView || isParentView
  const isTeacherStudentView = fromStudentsNav && isTeacher && roleLoaded
  const isAdminStudentView = fromStudentsNav && userRole === 'admin' && roleLoaded
  const isAdminMainView = userRole === 'admin' && !fromStudentsNav && roleLoaded
  const isTeacherMainView = isTeacher && !fromStudentsNav && roleLoaded
  const isReportsMainView =
    (isAdminMainView || (userRole === 'teacher' && isTeacherMainView)) &&
    activeTab === 'reports' &&
    !reportsStudentId
  const isReportsStudentView =
    (isAdminMainView || (userRole === 'teacher' && isTeacherMainView)) &&
    activeTab === 'reports' &&
    !!reportsStudentId
  const isAdminReportsStudentView = isReportsStudentView
  const showExamTypeSummaryBanner = isLearnerView || isAdminStudentView || isReportsStudentView
  const isCardExamView = isLearnerView || isTeacherStudentView || isReportsStudentView

  const reportsClassGroups = userRole === 'teacher' ? teacherClassGroups : classGroups
  const reportsClasses = userRole === 'teacher' ? teacherClasses : classes

  const reportGroupClasses = useMemo(() => {
    if (!reportGroupId) return []
    const group = reportsClassGroups.find((g) => g.id === reportGroupId)
    let cls = extractGroupClasses(group)
    if (userRole === 'teacher') {
      const teacherIds = new Set(teacherClasses.map((c) => c.id))
      cls = cls.filter((c) => teacherIds.has(c.id))
    }
    return cls
  }, [reportGroupId, reportsClassGroups, userRole, teacherClasses])

  const reportGroupClassIds = useMemo(
    () => new Set(reportGroupClasses.map((c) => c.id)),
    [reportGroupClasses]
  )

  const reportExams = useMemo(() => {
    let list = allExams
    if (userRole === 'teacher' && session?.user?.id) {
      list = list.filter((e) => isExamVisibleToTeacher(e, session.user.id))
    }

    return list.filter((exam) => {
      if (reportExamTypeId && exam.exam_type_id !== reportExamTypeId) return false

      if (reportGroupId) {
        const examClassIds = (exam.exam_classes ?? []).map((ec) => ec.class_id)
        const hasClassInGroup = examClassIds.some((cid) => reportGroupClassIds.has(cid))
        if (!hasClassInGroup) return false
      }

      return true
    })
  }, [allExams, reportExamTypeId, reportGroupId, reportGroupClassIds, userRole, session])

  const reportSubjects = useMemo(() => {
    const examList = reportExamId
      ? reportExams.filter((e) => e.id === reportExamId)
      : reportExams
    const subjectMap = new Map()
    for (const exam of examList) {
      for (const es of exam.exam_subjects ?? []) {
        if (es.subject_id && es.subjects?.name) {
          subjectMap.set(es.subject_id, es.subjects.name)
        }
      }
    }
    return Array.from(subjectMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [reportExams, reportExamId])

  const studentFilteredClasses = useMemo(() => {
    const sourceClasses = userRole === 'teacher' ? teacherClasses : classes
    const sourceGroups = userRole === 'teacher' ? teacherClassGroups : classGroups
    return filterClassesByGroup(sourceClasses, studentGroupId, sourceGroups)
  }, [userRole, teacherClasses, classes, studentGroupId, teacherClassGroups, classGroups])

  const sectionWiseRankings = useMemo(() => {
    if (!reportGroupId || reportViewMode !== 'section' || !reportRankings.length) return []
    const activeClasses = reportGroupClasses.filter((c) => reportSelectedClassIds.includes(c.id))
    return activeClasses.map((cls, index) => {
      const students = reportRankings
        .filter((s) => s.class_id === cls.id)
        .sort((a, b) => b.score - a.score)
      const avgPct = students.length
        ? Math.round(students.reduce((sum, s) => sum + s.percentage, 0) / students.length)
        : 0
      return { classId: cls.id, className: cls.name, students, avgPct, accentIndex: index }
    })
  }, [reportGroupId, reportViewMode, reportGroupClasses, reportSelectedClassIds, reportRankings])

  const groupOverallAvg = useMemo(() => {
    if (!reportGroupId || !reportRankings.length) return null
    return Math.round(reportRankings.reduce((sum, s) => sum + s.percentage, 0) / reportRankings.length)
  }, [reportGroupId, reportRankings])

  const cardExamId = isReportsStudentView
    ? reportViewExamId
    : (isTeacherMainView && activeTab === 'student' && expandedStudentId && (examId || expandedStudentExamId))
      ? (examId || expandedStudentExamId)
      : examId
  const cardExamTypeId = isReportsStudentView ? reportExamTypeId : selectedExamTypeId
  const cardExams = isReportsStudentView ? reportExams : exams
  const cardStudentId = isReportsStudentView
    ? reportsStudentId
    : isTeacherStudentView
      ? selectedStudentId
      : effectiveStudentId

  useEffect(() => {
    if (!session?.user?.id) return
    setRoleLoaded(false)
    supabase
      .from('users')
      .select('role, roll_number, institute_id, class_id')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        if (data?.role) setUserRole(data.role)

        if (data?.institute_id) {
          const { data: types } = await supabase
            .from('exam_types')
            .select('id, name')
            .eq('institute_id', data.institute_id)
            .order('name')
          setInstituteExamTypes(types ?? [])
        } else {
          setInstituteExamTypes([])
        }

        if (data?.role === 'parent') {
          const { data: linkedStudent } = await supabase
            .from('users')
            .select('id, class_id')
            .eq('roll_number', data.roll_number)
            .eq('role', 'student')
            .eq('institute_id', data.institute_id)
            .limit(1)
            .maybeSingle()

          setLinkedStudentId(linkedStudent?.id ?? null)
          setLinkedStudentClassId(linkedStudent?.class_id ?? null)
          setStudentClassId(null)
        } else if (data?.role === 'student') {
          setStudentClassId(data.class_id ?? null)
          setLinkedStudentId(null)
          setLinkedStudentClassId(null)
        } else {
          setStudentClassId(null)
          setLinkedStudentId(null)
          setLinkedStudentClassId(null)
        }
        setRoleLoaded(true)

        if (data?.role !== 'teacher' && data?.role !== 'admin') {
          setExamId('')
        } else if (fromStudentsNav) {
          setExamId('')
        }
      })
  }, [session])

  useEffect(() => {
    if (!examId || !isTeacher || !session?.user?.id) {
      setStudentRankings([])
      setLoadingStudentRankings(false)
      return
    }

    async function fetchRankings() {
      setLoadingStudentRankings(true)
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
        setLoadingStudentRankings(false)
        return
      }

      const { data: examData } = await supabase
        .from('exams')
        .select('total_questions, exam_type')
        .eq('id', examId)
        .single()

      const totalQ = examData?.total_questions ?? 0
      const isWrittenExam = examData?.exam_type === 'written'
      const studentIds = allStudents.map((s) => s.id)

      const scoreMap = {}
      const totalMap = {}
      let attendedSet = new Set()

      if (isWrittenExam) {
        const { data: summaries } = await supabase
          .from('omr_results')
          .select('student_id, marks_obtained, total_marks')
          .eq('exam_id', examId)
          .is('question_id', null)
          .in('student_id', studentIds)

        for (const r of summaries ?? []) {
          scoreMap[r.student_id] = r.marks_obtained ?? 0
          totalMap[r.student_id] = r.total_marks ?? totalQ
          attendedSet.add(r.student_id)
        }
      } else {
        const { data: scores } = await supabase
          .from('omr_results')
          .select('student_id, is_correct, question_id')
          .eq('exam_id', examId)
          .in('student_id', studentIds)

        for (const r of scores ?? []) {
          if (r.question_id == null) continue
          if (!scoreMap[r.student_id]) scoreMap[r.student_id] = 0
          if (r.is_correct) scoreMap[r.student_id] += 1
          attendedSet.add(r.student_id)
        }
      }

      const rankings = allStudents.map((s) => ({
        ...s,
        score: scoreMap[s.id] ?? 0,
        totalQ: totalMap[s.id] ?? totalQ,
        attended: attendedSet.has(s.id),
      }))

      rankings.sort((a, b) => {
        if (a.attended && !b.attended) return -1
        if (!a.attended && b.attended) return 1
        return b.score - a.score
      })

      setStudentRankings(rankings)
      setLoadingStudentRankings(false)
    }

    fetchRankings()
  }, [examId, isTeacher, session])

  useEffect(() => {
    if (!isAdminMainView || !session?.user?.id) return

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
            .order('name')
            .then(({ data: classData }) => {
              setClasses(classData ?? [])
            })
        } else {
          setClasses([])
        }
      })
  }, [isAdminMainView, session])

  useEffect(() => {
    if (!isAdminMainView || !session?.user?.id) return

    async function loadClassGroups() {
      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      if (!userData?.institute_id) {
        setClassGroups([])
        return
      }

      const { data } = await supabase
        .from('class_groups')
        .select('id, name, class_group_members(class_id, classes(id, name))')
        .eq('institute_id', userData.institute_id)
        .order('name')

      setClassGroups(data ?? [])
    }

    loadClassGroups()
  }, [isAdminMainView, session])

  useEffect(() => {
    if (userRole !== 'teacher' || !session?.user?.id) {
      setTeacherClasses([])
      setTeacherClassGroups([])
      return
    }

    async function loadTeacherClassesAndGroups() {
      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      if (!userData?.institute_id) {
        setTeacherClasses([])
        setTeacherClassGroups([])
        return
      }

      const { classes, groups } = await fetchTeacherClassesAndGroups(
        session.user.id,
        userData.institute_id
      )
      setTeacherClasses(classes)
      setTeacherClassGroups(groups)
    }

    loadTeacherClassesAndGroups()
  }, [userRole, session])

  useEffect(() => {
    if (reportGroupId && reportGroupClasses.length) {
      setReportSelectedClassIds(reportGroupClasses.map((c) => c.id))
      setReportClassId('')
      setReportViewMode('mixed')
    } else if (!reportGroupId) {
      setReportSelectedClassIds([])
    }
  }, [reportGroupId, reportGroupClasses])

  useEffect(() => {
    if (!studentGroupId) return
    if (selectedClassId && !studentFilteredClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId('')
      setExpandedStudentId(null)
      setExpandedStudentExamId(null)
      setSelectedStudentId('')
    }
  }, [studentGroupId, studentFilteredClasses, selectedClassId])

  useEffect(() => {
    if (!reportSubjects.some((s) => s.id === reportSubjectId)) {
      setReportSubjectId('')
    }
  }, [reportSubjects, reportSubjectId])

  useEffect(() => {
    if (!isReportsMainView || !session?.user?.id) {
      if (activeTab !== 'reports') setReportRankings([])
      return
    }

    async function loadReportRankings() {
      setLoadingReportRankings(true)

      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      if (!userData?.institute_id) {
        setReportRankings([])
        setLoadingReportRankings(false)
        return
      }

      const teacherClassIdList = teacherClasses.map((c) => c.id)
      const teacherClassIdSet = new Set(teacherClassIdList)

      if (userRole === 'teacher' && !teacherClassIdList.length) {
        setReportRankings([])
        setLoadingReportRankings(false)
        return
      }

      let studentQuery = supabase
        .from('users')
        .select('id, name, roll_number, class_id, classes(name)')
        .eq('role', 'student')
        .eq('institute_id', userData.institute_id)
        .order('roll_number')

      if (reportGroupId) {
        if (!reportSelectedClassIds.length) {
          setReportRankings([])
          setLoadingReportRankings(false)
          return
        }
        studentQuery = studentQuery.in('class_id', reportSelectedClassIds)
      } else if (reportClassId) {
        if (userRole === 'teacher' && !teacherClassIdSet.has(reportClassId)) {
          setReportRankings([])
          setLoadingReportRankings(false)
          return
        }
        studentQuery = studentQuery.eq('class_id', reportClassId)
      } else if (userRole === 'teacher') {
        studentQuery = studentQuery.in('class_id', teacherClassIdList)
      }

      const { data: students } = await studentQuery
      if (!students?.length) {
        setReportRankings([])
        setLoadingReportRankings(false)
        return
      }

      const studentIds = students.map((s) => s.id)

      if (reportExamId) {
        if (reportSubjectId) {
          const agg = await aggregateSubjectScores([reportExamId], reportSubjectId, studentIds)
          const rankings = students
            .filter((s) => agg[s.id]?.total > 0)
            .map((s) => {
              const { obtained, total } = agg[s.id]
              const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0
              return {
                id: s.id,
                name: s.name,
                roll_number: s.roll_number,
                class_id: s.class_id,
                className: s.classes?.name ?? '—',
                score: obtained,
                total,
                percentage,
                mode: 'single',
              }
            })
            .sort((a, b) => b.score - a.score)

          setReportRankings(rankings)
          setLoadingReportRankings(false)
          return
        }

        const { data: examData } = await supabase
          .from('exams')
          .select('total_questions, exam_type, total_marks')
          .eq('id', reportExamId)
          .single()

        if (!examData) {
          setReportRankings([])
          setLoadingReportRankings(false)
          return
        }

        const isWritten = examData.exam_type === 'written'
        const scoreMap = {}
        const totalMap = {}
        const hasResult = new Set()

        if (isWritten) {
          const { data: summaries } = await supabase
            .from('omr_results')
            .select('student_id, marks_obtained, total_marks')
            .eq('exam_id', reportExamId)
            .is('question_id', null)
            .in('student_id', studentIds)

          for (const r of summaries ?? []) {
            scoreMap[r.student_id] = r.marks_obtained ?? 0
            totalMap[r.student_id] = r.total_marks ?? 0
            hasResult.add(r.student_id)
          }
        } else {
          const { data: mcq } = await supabase
            .from('omr_results')
            .select('student_id, is_correct, question_id')
            .eq('exam_id', reportExamId)
            .in('student_id', studentIds)

          for (const r of mcq ?? []) {
            if (r.question_id == null) continue
            if (!scoreMap[r.student_id]) scoreMap[r.student_id] = 0
            if (r.is_correct) scoreMap[r.student_id] += 1
            hasResult.add(r.student_id)
          }
        }

        const totalQ = examData.total_questions ?? 0
        const rankings = students
          .filter((s) => hasResult.has(s.id))
          .map((s) => {
            const score = scoreMap[s.id] ?? 0
            const total = isWritten ? (totalMap[s.id] ?? examData.total_marks ?? 0) : totalQ
            const percentage = total > 0 ? Math.round((score / total) * 100) : 0
            return {
              id: s.id,
              name: s.name,
              roll_number: s.roll_number,
              class_id: s.class_id,
              className: s.classes?.name ?? '—',
              score,
              total,
              percentage,
              mode: 'single',
            }
          })
          .sort((a, b) => b.score - a.score)

        setReportRankings(rankings)
        setLoadingReportRankings(false)
        return
      }

      let examsForAgg = userRole === 'teacher' ? reportExams : allExams
      if (userRole !== 'teacher' && reportExamTypeId) {
        examsForAgg = examsForAgg.filter((e) => e.exam_type_id === reportExamTypeId)
      }

      if (reportSubjectId) {
        const examIds = examsForAgg.map((e) => e.id)
        const agg = await aggregateSubjectScores(examIds, reportSubjectId, studentIds)
        const rankings = students
          .filter((s) => agg[s.id]?.total > 0)
          .map((s) => {
            const { obtained, total } = agg[s.id]
            const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0
            return {
              id: s.id,
              name: s.name,
              roll_number: s.roll_number,
              class_id: s.class_id,
              className: s.classes?.name ?? '—',
              score: obtained,
              total,
              percentage,
              mode: 'aggregate',
            }
          })
          .sort((a, b) => b.score - a.score)

        setReportRankings(rankings)
        setLoadingReportRankings(false)
        return
      }

      const writtenExamIds = examsForAgg.filter((e) => e.exam_type === 'written').map((e) => e.id)
      const mcqExams = examsForAgg.filter((e) => e.exam_type !== 'written')

      const agg = {}
      for (const sid of studentIds) {
        agg[sid] = { obtained: 0, total: 0 }
      }

      if (writtenExamIds.length) {
        const { data: summaries } = await supabase
          .from('omr_results')
          .select('student_id, marks_obtained, total_marks')
          .in('exam_id', writtenExamIds)
          .is('question_id', null)
          .in('student_id', studentIds)

        for (const r of summaries ?? []) {
          agg[r.student_id].obtained += r.marks_obtained ?? 0
          agg[r.student_id].total += r.total_marks ?? 0
        }
      }

      if (mcqExams.length) {
        const mcqExamIds = mcqExams.map((e) => e.id)
        const { data: mcqResults } = await supabase
          .from('omr_results')
          .select('student_id, exam_id, is_correct, question_id')
          .in('exam_id', mcqExamIds)
          .in('student_id', studentIds)
          .not('question_id', 'is', null)

        const studentExamCorrect = {}
        const studentExamAttended = new Set()
        for (const r of mcqResults ?? []) {
          const key = `${r.student_id}::${r.exam_id}`
          if (!studentExamCorrect[key]) studentExamCorrect[key] = 0
          if (r.is_correct) studentExamCorrect[key] += 1
          studentExamAttended.add(key)
        }

        for (const key of studentExamAttended) {
          const [sid, eid] = key.split('::')
          const exam = mcqExams.find((e) => e.id === eid)
          const totalQ = exam?.total_questions ?? 0
          if (agg[sid]) {
            agg[sid].obtained += studentExamCorrect[key] ?? 0
            agg[sid].total += totalQ
          }
        }
      }

      const rankings = students
        .filter((s) => agg[s.id].total > 0)
        .map((s) => {
          const { obtained, total } = agg[s.id]
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0
          return {
            id: s.id,
            name: s.name,
            roll_number: s.roll_number,
            class_id: s.class_id,
            className: s.classes?.name ?? '—',
            score: obtained,
            total,
            percentage,
            mode: 'aggregate',
          }
        })
        .sort((a, b) => b.score - a.score)

      setReportRankings(rankings)
      setLoadingReportRankings(false)
    }

    loadReportRankings()
  }, [
    isReportsMainView,
    activeTab,
    reportsStudentId,
    reportExamTypeId,
    reportExamId,
    reportClassId,
    reportGroupId,
    reportSelectedClassIds,
    reportSubjectId,
    allExams,
    reportExams,
    teacherClasses,
    userRole,
    session,
  ])

  useEffect(() => {
    if (fromStudentsNav) {
      setStudentSearch('')
      return
    }
    if (!isTeacher) return
    setExpandedStudentId(null)
    setExpandedStudentExamId(null)
    setSelectedStudentId('')
    setStudentSearch('')
  }, [examId, selectedExamTypeId, selectedClassId, fromStudentsNav, isTeacher])

  useEffect(() => {
    if (!roleLoaded) return

    const examSelect =
      'id, name, exam_date, exam_type, exam_type_id, scope, total_questions, total_marks, created_by, exam_types(name), exam_subjects(subject_id, subjects(name)), exam_classes(class_id), exam_teachers(teacher_id)'

    if (userRole === 'student' || userRole === 'parent') {
      const classId = userRole === 'parent' ? linkedStudentClassId : studentClassId
      if (!classId) {
        setAllExams([])
        return
      }

      supabase
        .from('exams')
        .select(
          'id, name, exam_date, exam_type, exam_type_id, scope, total_questions, total_marks, created_by, exam_types(name), exam_subjects(subject_id, subjects(name)), exam_classes!inner(class_id), exam_teachers(teacher_id)'
        )
        .eq('exam_classes.class_id', classId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setAllExams(data ?? [])
        })
      return
    }

    if (userRole === 'admin' || userRole === 'teacher') {
      async function fetchAdminTeacherExams() {
        if (selectedStudentId) {
          const { data: studentData } = await supabase
            .from('users')
            .select('class_id')
            .eq('id', selectedStudentId)
            .single()

          const studentClassId = studentData?.class_id
          if (!studentClassId) {
            setAllExams([])
            return
          }

          const { data } = await supabase
            .from('exams')
            .select(
              'id, name, exam_date, exam_type, exam_type_id, scope, total_questions, total_marks, created_by, exam_types(name), exam_subjects(subject_id, subjects(name)), exam_classes!inner(class_id), exam_teachers(teacher_id)'
            )
            .filter('exam_classes.class_id', 'eq', studentClassId)
            .order('created_at', { ascending: false })

          const filtered = (data ?? []).filter((exam) =>
            exam.exam_classes?.some((ec) => ec.class_id === studentClassId)
          )
          setAllExams(filtered)
          return
        }

        const { data } = await supabase
          .from('exams')
          .select(examSelect)
          .order('created_at', { ascending: false })

        if (data) {
          setAllExams(data)
        }
      }

      fetchAdminTeacherExams()
    }
  }, [roleLoaded, userRole, studentClassId, linkedStudentClassId, selectedStudentId])

  useEffect(() => {
    if (isTeacherMainView && examId && !exams.some((e) => e.id === examId)) {
      setExamId('')
    }
    if (isCardExamView && examId && !exams.some((e) => e.id === examId)) {
      setExamId('')
    }
    if (activeTab === 'heatmap' && examId && !heatmapExams.some((e) => e.id === examId)) {
      setExamId('')
    }
    if (activeTab === 'student' && examId && !studentPerformanceExams.some((e) => e.id === examId)) {
      setExamId('')
    }
  }, [exams, heatmapExams, studentPerformanceExams, examId, isTeacherMainView, isCardExamView, activeTab])

  useEffect(() => {
    if (!isTeacherMainView || activeTab !== 'student' || !session?.user?.id) {
      setPerformanceStudents([])
      return
    }

    async function loadPerformanceStudents() {
      setLoadingPerformanceStudents(true)

      const { data: userData } = await supabase
        .from('users')
        .select('institute_id')
        .eq('id', session.user.id)
        .single()

      if (!userData?.institute_id) {
        setPerformanceStudents([])
        setLoadingPerformanceStudents(false)
        return
      }

      let studentQuery = supabase
        .from('users')
        .select('id, name, roll_number, class_id, classes(name)')
        .eq('role', 'student')
        .eq('institute_id', userData.institute_id)
        .order('roll_number')

      if (selectedClassId) {
        studentQuery = studentQuery.eq('class_id', selectedClassId)
      } else if (studentGroupId) {
        const sourceClasses = userRole === 'teacher' ? teacherClasses : classes
        const sourceGroups = userRole === 'teacher' ? teacherClassGroups : classGroups
        const groupClassIds = filterClassesByGroup(sourceClasses, studentGroupId, sourceGroups).map((c) => c.id)
        if (groupClassIds.length) {
          studentQuery = studentQuery.in('class_id', groupClassIds)
        }
      } else if (userRole === 'teacher' && teacherClasses.length) {
        studentQuery = studentQuery.in('class_id', teacherClasses.map((c) => c.id))
      }

      const { data: students } = await studentQuery
      setPerformanceStudents(students ?? [])
      setLoadingPerformanceStudents(false)
    }

    loadPerformanceStudents()
  }, [isTeacherMainView, activeTab, selectedClassId, studentGroupId, classGroups, classes, session, userRole, teacherClasses, teacherClassGroups])

  useEffect(() => {
    if (!isTeacherMainView || activeTab !== 'student' || !expandedStudentId || examId) {
      setStudentExamCards([])
      return
    }

    async function loadStudentExamCards() {
      setLoadingStudentExamCards(true)
      const studentId = expandedStudentId
      const student = performanceStudents.find((s) => s.id === studentId)
      const studentClassId = student?.class_id

      const [{ data: topicRows }, { data: writtenRows }, { data: mcqRows }] = await Promise.all([
        supabase.from('topic_scores').select('exam_id').eq('student_id', studentId),
        supabase.from('omr_results').select('exam_id, marks_obtained, total_marks').eq('student_id', studentId).is('question_id', null),
        supabase.from('omr_results').select('exam_id, is_correct, question_id').eq('student_id', studentId).not('question_id', 'is', null),
      ])

      const examIdSet = new Set()
      for (const row of topicRows ?? []) examIdSet.add(row.exam_id)
      for (const row of writtenRows ?? []) examIdSet.add(row.exam_id)
      for (const row of mcqRows ?? []) {
        if (row.question_id != null) examIdSet.add(row.exam_id)
      }

      const examIds = [...examIdSet]
      if (!examIds.length) {
        setStudentExamCards([])
        setLoadingStudentExamCards(false)
        return
      }

      const writtenMap = {}
      for (const row of writtenRows ?? []) {
        writtenMap[row.exam_id] = row
      }

      const mcqMap = {}
      const mcqAttended = new Set()
      for (const row of mcqRows ?? []) {
        if (row.question_id == null) continue
        if (!mcqMap[row.exam_id]) mcqMap[row.exam_id] = 0
        if (row.is_correct) mcqMap[row.exam_id] += 1
        mcqAttended.add(row.exam_id)
      }

      const cards = allExams
        .filter((exam) => examIds.includes(exam.id))
        .filter((exam) => !selectedExamTypeId || exam.exam_type_id === selectedExamTypeId)
        .filter((exam) => {
          if (!studentClassId) return true
          return (exam.exam_classes ?? []).some((ec) => ec.class_id === studentClassId)
        })
        .map((exam) => {
          if (exam.exam_type === 'written') {
            const summary = writtenMap[exam.id]
            if (!summary) {
              return {
                exam,
                notGraded: true,
                score: 0,
                total: exam.total_marks ?? 0,
                percentage: 0,
                hasResult: topicRows?.some((r) => r.exam_id === exam.id) ?? false,
              }
            }
            const score = summary.marks_obtained ?? 0
            const total = summary.total_marks ?? exam.total_marks ?? 0
            const percentage = total > 0 ? Math.round((score / total) * 100) : 0
            return { exam, notGraded: false, score, total, percentage, hasResult: true }
          }

          const score = mcqMap[exam.id] ?? 0
          const total = exam.total_questions ?? 0
          const hasResult = mcqAttended.has(exam.id) || (topicRows?.some((r) => r.exam_id === exam.id) ?? false)
          const percentage = total > 0 && hasResult ? Math.round((score / total) * 100) : 0
          return { exam, notGraded: false, score, total, percentage, hasResult }
        })
        .filter((card) => card.hasResult)
        .sort((a, b) => (b.exam.exam_date ?? '').localeCompare(a.exam.exam_date ?? ''))

      setStudentExamCards(cards)
      setLoadingStudentExamCards(false)
    }

    loadStudentExamCards()
  }, [isTeacherMainView, activeTab, expandedStudentId, examId, allExams, selectedExamTypeId, performanceStudents])

  useEffect(() => {
    if (!isCardExamView || cardExamId) {
      setExamSummaries([])
      return
    }
    if (!roleLoaded) return
    if (isParentView && !linkedStudentId) return
    if (isStudentView && !session?.user?.id) return
    if (isTeacherStudentView && !selectedStudentId) return
    if (isAdminReportsStudentView && !reportsStudentId) return

    if (!cardStudentId) return
    if (cardExams.length === 0) {
      setExamSummaries([])
      return
    }

    async function loadSummaries() {
      setLoadingSummaries(true)
      const examIds = cardExams.map((e) => e.id)

      const { data: writtenSummaries } = await supabase
        .from('omr_results')
        .select('exam_id, marks_obtained, total_marks')
        .eq('student_id', cardStudentId)
        .in('exam_id', examIds)
        .is('question_id', null)

      const { data: mcqResults } = await supabase
        .from('omr_results')
        .select('exam_id, is_correct, question_id')
        .eq('student_id', cardStudentId)
        .in('exam_id', examIds)
        .not('question_id', 'is', null)

      const writtenMap = {}
      for (const row of writtenSummaries ?? []) {
        writtenMap[row.exam_id] = row
      }

      const mcqMap = {}
      for (const row of mcqResults ?? []) {
        if (row.question_id == null) continue
        if (!mcqMap[row.exam_id]) mcqMap[row.exam_id] = 0
        if (row.is_correct) mcqMap[row.exam_id] += 1
      }

      const summaries = cardExams.map((exam) => {
        if (exam.exam_type === 'written') {
          const summary = writtenMap[exam.id]
          if (!summary) {
            return { exam, notGraded: true, score: 0, total: exam.total_marks ?? 0, percentage: 0, hasResult: false }
          }
          const score = summary.marks_obtained ?? 0
          const total = summary.total_marks ?? exam.total_marks ?? 0
          const percentage = total > 0 ? Math.round((score / total) * 100) : 0
          return { exam, notGraded: false, score, total, percentage, hasResult: true }
        }

        const score = mcqMap[exam.id] ?? 0
        const total = exam.total_questions ?? 0
        const hasResult = (mcqResults ?? []).some((r) => r.exam_id === exam.id)
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0
        return { exam, notGraded: false, score, total, percentage, hasResult }
      })

      setExamSummaries(summaries)
      setLoadingSummaries(false)
    }

    loadSummaries()
  }, [isCardExamView, cardExamId, cardExams, cardStudentId, isTeacherStudentView, isAdminReportsStudentView, isParentView, isStudentView, roleLoaded, linkedStudentId, session, reportsStudentId, selectedStudentId, effectiveStudentId])

  useEffect(() => {
    if (!cardExamId) return

    let resultStudentId = null
    if (isAdminReportsStudentView) {
      if (!reportsStudentId) return
      resultStudentId = reportsStudentId
    } else if (isTeacher) {
      if (!selectedStudentId) {
        setResult(null)
        setLoading(false)
        return
      }
      resultStudentId = selectedStudentId
    } else {
      if (!roleLoaded) return
      if (userRole === 'parent' && !linkedStudentId) return
      if (userRole === 'student' && !session?.user?.id) return
      if (!effectiveStudentId) return
      resultStudentId = effectiveStudentId
    }

    async function loadResults() {
      setLoading(true)

      const { data: examMeta } = await supabase
        .from('exams')
        .select('exam_type')
        .eq('id', cardExamId)
        .single()

      const isWrittenExam = examMeta?.exam_type === 'written'

      let query = supabase
        .from('topic_scores')
        .select('topic_id, chapter_id, subject_id, score, total, percentage, topics(name), chapters(name), subjects(name)')
        .eq('exam_id', cardExamId)
        .eq('student_id', resultStudentId)

      const { data } = await query

      const subjectMap = {}
      for (const row of data ?? []) {
        const sid = row.subject_id ?? 'unknown'
        if (!subjectMap[sid]) {
          subjectMap[sid] = { subject_id: sid, name: row.subjects?.name ?? 'General', score: 0, max: 0, percentage: 0, topics: [] }
        }
        subjectMap[sid].topics.push({
          name: topicScoreDisplayName(row),
          score: row.score,
          total: row.total,
          percentage: row.percentage,
        })
        subjectMap[sid].score += row.score
        subjectMap[sid].max += row.total
      }
      const subjects = Object.values(subjectMap).map((s) => ({ ...s, percentage: s.max > 0 ? Math.round((s.score / s.max) * 100) : 0 }))

      if (isWrittenExam) {
        if (!resultStudentId) {
          setResult({
            notGraded: true,
            totalScore: 0,
            totalMax: 0,
            percentage: 0,
            classTop: 0,
            subjects,
          })
          setActiveSubject(subjects.length > 0 ? subjects[0].subject_id : '')
          setLoading(false)
          return
        }

        const { data: summary } = await supabase
          .from('omr_results')
          .select('marks_obtained, total_marks')
          .eq('exam_id', cardExamId)
          .eq('student_id', resultStudentId)
          .is('question_id', null)
          .maybeSingle()

        if (!summary) {
          setResult({
            notGraded: true,
            totalScore: 0,
            totalMax: 0,
            percentage: 0,
            classTop: 0,
            subjects,
          })
          setActiveSubject(subjects.length > 0 ? subjects[0].subject_id : '')
          setLoading(false)
          return
        }

        const totalScore = summary.marks_obtained ?? 0
        const totalMax = summary.total_marks ?? 0
        const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0

        const { data: allSummaries } = await supabase
          .from('omr_results')
          .select('marks_obtained')
          .eq('exam_id', cardExamId)
          .is('question_id', null)

        const classTop = allSummaries?.length
          ? Math.max(...allSummaries.map((r) => r.marks_obtained ?? 0))
          : 0

        setResult({ notGraded: false, totalScore, totalMax, percentage, classTop, subjects })
        setActiveSubject(subjects.length > 0 ? subjects[0].subject_id : '')
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setResult(null)
        setLoading(false)
        return
      }

      let totalScore = subjects.reduce((sum, s) => sum + s.score, 0)
      let totalMax = subjects.reduce((sum, s) => sum + s.max, 0)
      let percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
      const newResult = { notGraded: false, totalScore, totalMax, percentage, classTop: 0, subjects }

      const { data: allScores } = await supabase
        .from('topic_scores')
        .select('student_id, score')
        .eq('exam_id', cardExamId)

      if (allScores && allScores.length > 0) {
        const studentTotals = {}
        for (const row of allScores) {
          if (!studentTotals[row.student_id]) studentTotals[row.student_id] = 0
          studentTotals[row.student_id] += row.score
        }
        newResult.classTop = Math.max(...Object.values(studentTotals))
      }

      setResult(newResult)
      if (subjects.length > 0) setActiveSubject(subjects[0].subject_id)
      setLoading(false)
    }

    loadResults()
  }, [cardExamId, isTeacher, isAdminReportsStudentView, selectedStudentId, reportsStudentId, effectiveStudentId, roleLoaded, userRole, linkedStudentId, session])

  useEffect(() => {
    if (cardExams.length === 0) return
    if (isAdminReportsStudentView) {
      if (!reportsStudentId) {
        setTrendData([])
        return
      }
      if (cardExamId) {
        setTrendData([])
        return
      }
    } else if (isTeacher && !selectedStudentId) {
      setTrendData([])
      return
    } else if (!isTeacher || fromStudentsNav) {
      if (cardExamId) {
        setTrendData([])
        return
      }
      if (!roleLoaded) return
      if (fromStudentsNav && isTeacher) {
        if (!selectedStudentId) return
      } else {
        if (userRole === 'parent' && !linkedStudentId) return
        if (userRole === 'student' && !session?.user?.id) return
        if (!effectiveStudentId) return
      }
    }

    if (!cardStudentId) return

    setLoadingTrend(true)
    const query = supabase
      .from('topic_scores')
      .select('exam_id, topic_id, chapter_id, subject_id, score, total, percentage, topics(name), chapters(name), subjects(name), exams(exam_date)')
      .in('exam_id', cardExams.map((e) => e.id))
      .eq('student_id', cardStudentId)

    query.then(({ data }) => {
        if (!data || data.length === 0) { setLoadingTrend(false); return }
        const subjectMap = {}
        for (const row of data) {
          const sid = row.subject_id ?? 'unknown'
          const sname = row.subjects?.name ?? 'General'
          const tname = topicScoreDisplayName(row)
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
  }, [cardExams, cardExamId, cardStudentId, isTeacher, isAdminReportsStudentView, fromStudentsNav, selectedStudentId, reportsStudentId, effectiveStudentId, roleLoaded, userRole, linkedStudentId, session])

  const subject = result?.subjects?.find((s) => s.subject_id === activeSubject) ?? result?.subjects?.[0]

  const selectedExam = cardExams.find((e) => e.id === cardExamId) ?? exams.find((e) => e.id === examId)

  const displayedRankings = useMemo(() => {
    if (selectedClassId) {
      return studentRankings.filter((s) => s.class_id === selectedClassId)
    }
    if (studentGroupId) {
      const groupClassIds = new Set(studentFilteredClasses.map((c) => c.id))
      return studentRankings.filter((s) => groupClassIds.has(s.class_id))
    }
    return studentRankings
  }, [selectedClassId, studentGroupId, studentFilteredClasses, studentRankings])

  const searchedRankings = displayedRankings.filter((s) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    String(s.roll_number).includes(studentSearch)
  )

  const searchedPerformanceStudents = performanceStudents.filter((s) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    String(s.roll_number).includes(studentSearch)
  )

  const performanceListStudents = examId ? searchedRankings : searchedPerformanceStudents
  const performanceListLoading = examId ? loadingStudentRankings : loadingPerformanceStudents

  const inlinePerformanceExamId = examId || expandedStudentExamId

  const examTypeSummary = useMemo(() => {
    const activeTypeId = isAdminReportsStudentView ? reportExamTypeId : selectedExamTypeId
    if (!activeTypeId || !showExamTypeSummaryBanner) return null

    const typeName = instituteExamTypes.find((t) => t.id === activeTypeId)?.name ?? 'Exam Type'
    const gradedExams = examSummaries.filter((s) => !s.notGraded && s.hasResult)

    if (gradedExams.length === 0) {
      return { typeName, noGraded: true }
    }

    const sumObtained = gradedExams.reduce((sum, s) => sum + s.score, 0)
    const sumTotal = gradedExams.reduce((sum, s) => sum + s.total, 0)
    const percentage = sumTotal > 0 ? Math.round((sumObtained / sumTotal) * 100) : 0

    return { typeName, sumObtained, sumTotal, percentage, noGraded: false }
  }, [selectedExamTypeId, reportExamTypeId, isAdminReportsStudentView, examSummaries, instituteExamTypes, showExamTypeSummaryBanner])

  function examTypeSummaryPctClass(pct) {
    if (pct >= 70) return 'text-green-600 dark:text-green-400'
    if (pct >= 40) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  function renderCardExamFlow({ blocked = false, blockedMessage = null, flowOverride = null }) {
    const flowExamTypeId = flowOverride?.examTypeId ?? selectedExamTypeId
    const flowSetExamTypeId = flowOverride?.setExamTypeId ?? setSelectedExamTypeId
    const flowExamId = flowOverride?.examId ?? examId
    const flowSetExamId = flowOverride?.setExamId ?? setExamId
    const flowExams = flowOverride?.exams ?? exams

    return (
      <>
        {flowOverride?.onBackToReports && (
          <button
            type="button"
            onClick={flowOverride.onBackToReports}
            className="self-start text-sm font-medium text-green-600 hover:text-green-800"
          >
            ← Back to Reports
          </button>
        )}

        {flowOverride?.studentName && (
          <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
            Viewing results for: {flowOverride.studentName}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <select
            value={flowExamTypeId}
            onChange={(e) => flowSetExamTypeId(e.target.value)}
            className="w-full md:w-64 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Exam Types</option>
            {instituteExamTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {flowExamId && (
            <button
              type="button"
              onClick={() => flowSetExamId('')}
              className="self-start text-sm font-medium text-green-600 hover:text-green-800"
            >
              ← Back
            </button>
          )}
        </div>

        {showExamTypeSummaryBanner && flowExamTypeId && !flowExamId && !blocked && !loadingSummaries && examTypeSummary && (
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
              {examTypeSummary.typeName} Summary
            </h2>
            {examTypeSummary.noGraded ? (
              <p className="text-sm text-gray-500 dark:text-[#A8A8A8] mt-2">No graded exams yet</p>
            ) : (
              <p className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-green-500">
                  Total Score: {examTypeSummary.sumObtained} / {examTypeSummary.sumTotal}
                </span>
                <span className={`text-2xl font-bold ${examTypeSummaryPctClass(examTypeSummary.percentage)}`}>
                  ({examTypeSummary.percentage}%)
                </span>
              </p>
            )}
          </div>
        )}

        {blocked && blockedMessage && (
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
            <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">{blockedMessage}</p>
          </div>
        )}

        {!flowExamId && !blocked && (
          <>
            {loadingSummaries && (
              <div className="flex justify-center items-center h-64">
                <Loader size={40} />
              </div>
            )}

            {!loadingSummaries && flowExams.length === 0 && (
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
                <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No exams found.</p>
              </div>
            )}

            {!loadingSummaries && examSummaries.length > 0 && (
              <div className="flex flex-col gap-3">
                {examSummaries.map(({ exam, notGraded, score, total, percentage, hasResult }) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => flowSetExamId(exam.id)}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 shadow-sm text-left hover:border-green-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">{exam.name}</p>
                        <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-0.5">{formatExamDate(exam.exam_date)}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <ExamTypeBadge examType={exam.exam_type} />
                          <InstituteExamTypeBadge name={exam.exam_types?.name} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {notGraded ? (
                          <p className="text-sm font-medium text-gray-500 dark:text-[#A8A8A8]">Not graded</p>
                        ) : !hasResult ? (
                          <p className="text-sm font-medium text-gray-400 dark:text-[#A8A8A8]">No results</p>
                        ) : (
                          <>
                            <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">{score} / {total}</p>
                            <p className="text-xs text-green-600 font-medium">{percentage}%</p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loadingTrend && trendData.length > 0 && (
              <PerformanceTrend trendData={trendData} totalExams={flowExams.length} />
            )}
          </>
        )}

        {flowExamId && !blocked && loading && (
          <div className="flex justify-center items-center h-64">
            <Loader size={40} />
          </div>
        )}

        {flowExamId && !blocked && !loading && !result && (
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
            <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No results found for this exam yet.</p>
            <p className="text-gray-400 dark:text-[#A8A8A8] text-xs mt-1">Scan some OMR sheets first.</p>
          </div>
        )}

        {flowExamId && !blocked && !loading && result && (
          <>
            {selectedExam && (
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF]">{selectedExam.name}</h2>
                <ExamTypeBadge examType={selectedExam.exam_type} />
                <InstituteExamTypeBadge name={selectedExam.exam_types?.name} />
              </div>
            )}
            <OverallScoreCard result={result} />
            {subject && (
              <div className="flex flex-col gap-5">
                <SubjectTabs subjects={result.subjects} active={subject.subject_id} onChange={setActiveSubject} />
                <TopicPerformance subject={subject} />
                <TopicSummary subject={subject} />
              </div>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] px-4 py-6">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF]">My Performance</h1>
          </div>
          {isTeacherMainView && activeTab !== 'reports' && (
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={selectedExamTypeId}
                onChange={(e) => {
                  setSelectedExamTypeId(e.target.value)
                  if (activeTab === 'heatmap' || activeTab === 'student') setExamId('')
                }}
                className="w-full md:w-auto rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Exam Types</option>
                {instituteExamTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {activeTab === 'heatmap' && heatmapClassGroups.length > 0 && (
                <select
                  value={heatmapGroupId}
                  onChange={(e) => {
                    setHeatmapGroupId(e.target.value)
                    setExamId('')
                  }}
                  className="w-full md:w-auto rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="">All Groups</option>
                  {heatmapClassGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
              {activeTab === 'student' && studentClassGroups.length > 0 && (
                <select
                  value={studentGroupId}
                  onChange={(e) => {
                    setStudentGroupId(e.target.value)
                    setSelectedClassId('')
                    setExamId('')
                    setExpandedStudentId(null)
                    setExpandedStudentExamId(null)
                    setSelectedStudentId('')
                    setStudentSearch('')
                  }}
                  className="w-full md:w-auto rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="">All Groups</option>
                  {studentClassGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
              <select
                value={examId}
                onChange={(e) => {
                  setExamId(e.target.value)
                  setExpandedStudentId(null)
                  setExpandedStudentExamId(null)
                  setSelectedStudentId('')
                }}
                className="w-full md:w-auto rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Exams</option>
                {(activeTab === 'heatmap'
                  ? heatmapExams
                  : activeTab === 'student'
                    ? studentPerformanceExams
                    : exams
                ).map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
                ))}
              </select>
              {activeTab === 'student' && (
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setExpandedStudentId(null)
                    setExpandedStudentExamId(null)
                    setSelectedStudentId('')
                    setStudentSearch('')
                  }}
                  className="w-full md:w-auto rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm font-medium text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="">All Classes</option>
                  {studentFilteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </header>

        {isTeacherMainView && (
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
            <button
              onClick={() => {
                setActiveTab('student')
                setReportsStudentId('')
                setReportsStudentName('')
                setReportViewExamId('')
              }}
              className={`px-4 py-2.5 text-sm font-medium relative ${activeTab === 'student' ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8]'}`}
            >
              Student Performance
              {activeTab === 'student' && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />}
            </button>
            <button
              onClick={() => {
                setActiveTab('heatmap')
                setReportsStudentId('')
                setReportsStudentName('')
                setReportViewExamId('')
              }}
              className={`px-4 py-2.5 text-sm font-medium relative ${activeTab === 'heatmap' ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8]'}`}
            >
              Class Heatmap
              {activeTab === 'heatmap' && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />}
            </button>
            {isTeacherMainView && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2.5 text-sm font-medium relative ${activeTab === 'reports' ? 'text-gray-900 dark:text-[#FFFFFF]' : 'text-gray-500 dark:text-[#A8A8A8]'}`}
              >
                Student Reports
                {activeTab === 'reports' && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-600 rounded-full" />}
              </button>
            )}
          </div>
        )}

        {isTeacherMainView && activeTab === 'heatmap' && !examId && (
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
            <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">Select an exam to view the class heatmap.</p>
          </div>
        )}

        {isTeacherMainView && activeTab === 'heatmap' && examId && (
          <ClassHeatmap
            examId={examId}
            exams={exams}
            session={session}
            userRole={userRole}
            groupId={heatmapGroupId}
          />
        )}

        {isReportsMainView && (
          <StudentReportsPanel
            classGroups={reportsClassGroups}
            reportClasses={reportsClasses}
            reportGroupClasses={reportGroupClasses}
            instituteExamTypes={instituteExamTypes}
            reportExams={reportExams}
            reportGroupId={reportGroupId}
            setReportGroupId={setReportGroupId}
            reportExamTypeId={reportExamTypeId}
            setReportExamTypeId={setReportExamTypeId}
            reportExamId={reportExamId}
            setReportExamId={setReportExamId}
            reportClassId={reportClassId}
            setReportClassId={setReportClassId}
            reportSelectedClassIds={reportSelectedClassIds}
            setReportSelectedClassIds={setReportSelectedClassIds}
            reportViewMode={reportViewMode}
            setReportViewMode={setReportViewMode}
            reportSubjects={reportSubjects}
            reportSubjectId={reportSubjectId}
            setReportSubjectId={setReportSubjectId}
            showSubjectFilter={userRole === 'teacher'}
            loadingReportRankings={loadingReportRankings}
            reportRankings={reportRankings}
            sectionWiseRankings={sectionWiseRankings}
            groupOverallAvg={groupOverallAvg}
            onStudentClick={(s) => {
              setReportsStudentId(s.id)
              setReportsStudentName(s.name)
              setReportViewExamId('')
            }}
          />
        )}

        {isReportsStudentView && renderCardExamFlow({
          flowOverride: {
            examTypeId: reportExamTypeId,
            setExamTypeId: setReportExamTypeId,
            examId: reportViewExamId,
            setExamId: setReportViewExamId,
            exams: reportExams,
            studentName: reportsStudentName,
            onBackToReports: () => {
              setReportsStudentId('')
              setReportsStudentName('')
              setReportViewExamId('')
            },
          },
        })}

        {isCardExamView && !isReportsStudentView && renderCardExamFlow({
          blocked: isParentView && !linkedStudentId,
          blockedMessage: 'No linked student found for this parent account.',
        })}

        {isTeacherMainView && activeTab === 'student' && (
          <>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, roll number, or exam..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              />
            </div>

            {performanceListLoading && (
              <div className="flex justify-center items-center h-64">
                <Loader size={40} />
              </div>
            )}

            {!performanceListLoading && examId && displayedRankings.length === 0 && studentRankings.length > 0 && selectedClassId && (
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
                <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No students in this class</p>
              </div>
            )}

            {!performanceListLoading && examId && studentRankings.length === 0 && (
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
                <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No students found for this exam</p>
              </div>
            )}

            {!performanceListLoading && !examId && performanceStudents.length === 0 && (
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-8 text-center shadow-sm">
                <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No students found.</p>
              </div>
            )}

            {!performanceListLoading && performanceListStudents.length > 0 && (
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
                    {examId
                      ? `Class Results — ${displayedRankings.length} students`
                      : `Students — ${performanceListStudents.length}`}
                    {examId && selectedExam && (
                      <span className="font-normal text-gray-500 dark:text-[#A8A8A8]"> · {selectedExam.name}</span>
                    )}
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {performanceListStudents.map((s) => {
                    const index = examId ? displayedRankings.indexOf(s) : -1
                    const isExpanded = expandedStudentId === s.id
                    const showExamCards = isExpanded && !examId && !expandedStudentExamId
                    const showTopics = isExpanded && inlinePerformanceExamId
                    const inlineExam = allExams.find((e) => e.id === inlinePerformanceExamId)

                    return (
                      <div key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedStudentId(null)
                              setSelectedStudentId('')
                              setExpandedStudentExamId(null)
                              setResult(null)
                              return
                            }
                            setExpandedStudentId(s.id)
                            setSelectedStudentId(s.id)
                            setExpandedStudentExamId(examId || null)
                            setResult(null)
                          }}
                          className={`w-full min-h-[56px] flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors text-left ${
                            isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {examId ? (
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                !s.attended
                                  ? 'bg-gray-100 dark:bg-[#262626] text-gray-400 dark:text-[#A8A8A8]'
                                  : index === 0
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : index === 1
                                      ? 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8]'
                                      : index === 2
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-50 dark:bg-[#262626] text-gray-500 dark:text-[#A8A8A8]'
                              }`}
                            >
                              {s.attended ? index + 1 : '—'}
                            </span>
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#262626] flex items-center justify-center shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-[#A8A8A8]" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500 dark:text-[#A8A8A8]" />
                              )}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-sm truncate">{s.name}</p>
                            <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">
                              Roll #{s.roll_number}
                              {!selectedClassId && s.classes?.name && ` · ${s.classes.name}`}
                            </p>
                          </div>

                          {examId && (
                            <div className="text-right shrink-0">
                              {s.attended ? (
                                <>
                                  <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">
                                    {s.score} / {s.totalQ}
                                  </p>
                                  <p className={`text-xs font-medium ${performancePctClass(s.totalQ > 0 ? Math.round((s.score / s.totalQ) * 100) : 0)}`}>
                                    {s.totalQ > 0 ? Math.round((s.score / s.totalQ) * 100) : 0}%
                                  </p>
                                </>
                              ) : (
                                <div>
                                  <p className="font-semibold text-gray-500 dark:text-[#A8A8A8] text-sm">0 / {s.totalQ}</p>
                                  <p className="text-xs text-red-400">Absent</p>
                                </div>
                              )}
                            </div>
                          )}

                          {examId && (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                            )
                          )}
                        </button>

                        {showExamCards && loadingStudentExamCards && (
                          <div className="flex justify-center items-center h-32 mx-4 mb-4">
                            <Loader size={40} />
                          </div>
                        )}

                        {showExamCards && !loadingStudentExamCards && studentExamCards.length === 0 && (
                          <div className="mx-4 mb-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-6 text-center">
                            <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No exam results found for this student yet.</p>
                          </div>
                        )}

                        {showExamCards && !loadingStudentExamCards && studentExamCards.length > 0 && (
                          <div className="mx-4 mb-4 flex flex-col gap-2">
                            {studentExamCards.map((card) => (
                              <button
                                key={card.exam.id}
                                type="button"
                                onClick={() => {
                                  setExpandedStudentExamId(card.exam.id)
                                  setResult(null)
                                }}
                                className="w-full text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-[#FFFFFF] text-sm truncate">{card.exam.name}</p>
                                    <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-0.5">{formatExamDate(card.exam.exam_date)}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      <ExamTypeBadge examType={card.exam.exam_type} />
                                      <InstituteExamTypeBadge name={card.exam.exam_types?.name} />
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {card.notGraded ? (
                                      <p className="text-sm font-medium text-gray-500 dark:text-[#A8A8A8]">Not graded</p>
                                    ) : (
                                      <>
                                        <p className="font-semibold text-gray-900 dark:text-[#FFFFFF] text-sm">
                                          {card.score} / {card.total}
                                        </p>
                                        <p className={`text-xs font-medium ${performancePctClass(card.percentage)}`}>
                                          {card.percentage}%
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {showTopics && loading && (
                          <div className="flex justify-center items-center h-32 mx-4 mb-4">
                            <Loader size={40} />
                          </div>
                        )}

                        {showTopics && !loading && !result && (
                          <div className="mx-4 mb-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1C] shadow-sm p-6 text-center">
                            <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">No results found for this exam yet.</p>
                            <p className="text-gray-400 dark:text-[#A8A8A8] text-xs mt-1">Scan some OMR sheets first.</p>
                          </div>
                        )}

                        {showTopics && !loading && result && (
                          <div className="mx-4 mb-4 border border-blue-100 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-[#1C1C1C]">
                            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-gray-600">
                              <div className="flex items-center gap-2 min-w-0">
                                {!examId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedStudentExamId(null)
                                      setResult(null)
                                    }}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm shrink-0"
                                  >
                                    ← Back
                                  </button>
                                )}
                                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                                  {s.name}&apos;s Performance
                                  {inlineExam && ` · ${inlineExam.name}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedStudentId(null)
                                  setSelectedStudentId('')
                                  setExpandedStudentExamId(null)
                                  setResult(null)
                                }}
                                className="text-blue-400 hover:text-blue-600 text-sm shrink-0"
                              >
                                ✕ Close
                              </button>
                            </div>
                            <div className="p-4 flex flex-col gap-4">
                              <OverallScoreCard result={result} />
                              {subject && (
                                <>
                                  <SubjectTabs
                                    subjects={result.subjects}
                                    active={subject.subject_id}
                                    onChange={setActiveSubject}
                                  />
                                  <TopicPerformance subject={subject} />
                                  <TopicSummary subject={subject} />
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!performanceListLoading && studentSearch && performanceListStudents.length === 0 && (
              (examId ? displayedRankings.length > 0 : performanceStudents.length > 0) && (
                <p className="text-sm text-gray-400 dark:text-[#A8A8A8] text-center py-4">
                  No students found matching &quot;{studentSearch}&quot;
                </p>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
