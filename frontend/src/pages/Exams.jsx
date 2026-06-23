import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import Loader from '../components/Loader'

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

function filterClassesByGroup(classes, groupId, classGroups) {
  if (!groupId) return classes
  const group = classGroups.find((g) => g.id === groupId)
  const groupClassIds = new Set(group?.class_group_members?.map((m) => m.class_id) ?? [])
  return classes.filter((c) => groupClassIds.has(c.id))
}

function computeSubjectIntersection(adminClassSubjects, selectedClassIds) {
  if (selectedClassIds.length === 0) return []

  const subjectsByClass = {}
  for (const row of adminClassSubjects) {
    if (!subjectsByClass[row.class_id]) subjectsByClass[row.class_id] = new Map()
    if (row.subjects) subjectsByClass[row.class_id].set(row.subject_id, row.subjects)
  }

  if (selectedClassIds.length === 1) {
    const classId = selectedClassIds[0]
    const map = subjectsByClass[classId] ?? new Map()
    return Array.from(map.values())
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  let intersection = null
  for (const classId of selectedClassIds) {
    const subjectIds = new Set((subjectsByClass[classId] ?? new Map()).keys())
    intersection = intersection === null
      ? subjectIds
      : new Set([...intersection].filter((id) => subjectIds.has(id)))
  }

  const firstMap = subjectsByClass[selectedClassIds[0]] ?? new Map()
  return [...(intersection ?? [])]
    .map((id) => ({ id, name: firstMap.get(id)?.name ?? 'Unknown' }))
    .filter((s) => s.name)
    .sort((a, b) => a.name.localeCompare(b.name))
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
  const [examType, setExamType] = useState('written')
  const [examDate, setExamDate] = useState('')
  const [totalQuestions, setTotalQuestions] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [scope, setScope] = useState('class')
  const [selectedClassIds, setSelectedClassIds] = useState([])
  const [classes, setClasses] = useState([])
  const [classGroups, setClassGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [createStep, setCreateStep] = useState(1)
  const [adminClassSubjects, setAdminClassSubjects] = useState([])
  const [availableClasses, setAvailableClasses] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [instituteId, setInstituteId] = useState(null)
  const [instituteExamTypes, setInstituteExamTypes] = useState([])
  const [newInstituteExamType, setNewInstituteExamType] = useState('')
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('')
  const [examListTypeFilter, setExamListTypeFilter] = useState('')
  const [examListClassFilter, setExamListClassFilter] = useState('')
  const [savingExamType, setSavingExamType] = useState(false)
  const [assignClassesExamId, setAssignClassesExamId] = useState(null)
  const [assigningClass, setAssigningClass] = useState(false)
  const [assignTeachersExamId, setAssignTeachersExamId] = useState(null)
  const [assigningTeacher, setAssigningTeacher] = useState(false)
  const [instituteTeachers, setInstituteTeachers] = useState([])
  const [editingExamId, setEditingExamId] = useState(null)
  const [editExamName, setEditExamName] = useState('')
  const [editExamType, setEditExamType] = useState('written')
  const [editExamTypeId, setEditExamTypeId] = useState('')
  const [editExamDate, setEditExamDate] = useState('')
  const [editTotalQuestions, setEditTotalQuestions] = useState('')
  const [editTotalMarks, setEditTotalMarks] = useState('')
  const [editSubjectRanges, setEditSubjectRanges] = useState([])
  const [savingExamEdit, setSavingExamEdit] = useState(false)

  // Add questions panel
  const [activeExam, setActiveExam] = useState(null)
  const [examSubjects, setExamSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [chapterTopics, setChapterTopics] = useState([])
  const [activeSubjectId, setActiveSubjectId] = useState('')
  const [activeChapterId, setActiveChapterId] = useState('')
  const [activeTopicId, setActiveTopicId] = useState('')
  const [selectedQNums, setSelectedQNums] = useState([])
  const [questionMap, setQuestionMap] = useState({})
  const [showWrittenQuestionText, setShowWrittenQuestionText] = useState(false)

  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiExamId, setAiExamId] = useState(null)
  const [aiExamSubjects, setAiExamSubjects] = useState([])
  const [aiTotalQuestions, setAiTotalQuestions] = useState('')
  const [aiChapterAllocations, setAiChapterAllocations] = useState({})
  const [aiSelectedChapters, setAiSelectedChapters] = useState({})
  const [aiTopicAllocations, setAiTopicAllocations] = useState({})
  const [aiSelectedTopics, setAiSelectedTopics] = useState({})
  const [aiBoard, setAiBoard] = useState('CBSE')
  const [aiClassLevel, setAiClassLevel] = useState('')
  const [aiEasy, setAiEasy] = useState(30)
  const [aiMedium, setAiMedium] = useState(50)
  const [aiHard, setAiHard] = useState(20)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [generating, setGenerating] = useState(false)
  const [savingGenerated, setSavingGenerated] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiStep, setAiStep] = useState(2)

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

  async function fetchExamTypes(instId) {
    if (!instId) {
      setInstituteExamTypes([])
      return
    }

    const { data, error: fetchError } = await supabase
      .from('exam_types')
      .select('id, name, created_by')
      .eq('institute_id', instId)
      .order('name')

    if (fetchError) throw new Error(fetchError.message)
    setInstituteExamTypes(data ?? [])
  }

  async function fetchInstituteTeachers(instId) {
    if (!instId) {
      setInstituteTeachers([])
      return
    }

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'teacher')
      .eq('institute_id', instId)
      .order('name')

    if (fetchError) throw new Error(fetchError.message)
    setInstituteTeachers(data ?? [])
  }

  async function fetchExams() {
    const { data, error: fetchError } = await supabase
      .from('exams')
      .select('id, name, exam_date, total_questions, total_marks, scope, exam_type, exam_type_id, created_by, users!created_by(name, role), exam_types(name), exam_subjects(subject_id, question_from, question_to, subjects(name)), exam_classes(class_id, classes(name)), exam_teachers(teacher_id, users(name))')
      .order('created_at', { ascending: false })
    if (fetchError) throw new Error(fetchError.message)

    const examsData = (data ?? []).map((e) => {
      const creator = e.users ?? null
      const { users, ...rest } = e
      return {
        ...rest,
        creator_role: creator?.role ?? null,
        creator_name: creator?.name ?? null,
      }
    })

    setExams(examsData)
  }

  function canManageExamQuestions(exam) {
    if (!exam || !currentUserId) return false
    if (userRole === 'admin') return true
    if (exam.created_by === currentUserId) return true
    return (exam.exam_teachers ?? []).some((et) => et.teacher_id === currentUserId)
  }

  function isTeacherAssignedToExam(exam) {
    return (exam.exam_teachers ?? []).some((et) => et.teacher_id === currentUserId)
  }

  function showAssignedByAdminBadge(exam) {
    return (
      userRole === 'teacher' &&
      exam.creator_role === 'admin' &&
      isTeacherAssignedToExam(exam)
    )
  }

  function showAssignedByCreatorBadge(exam) {
    return userRole === 'teacher' && exam.created_by !== currentUserId
  }

  function canDeleteExam(exam) {
    if (!exam || !currentUserId) return false
    if (showAssignedByAdminBadge(exam)) return false
    if (userRole === 'admin') return true
    if (exam.created_by === currentUserId) return true
    return false
  }

  function canEditExam(exam) {
    if (!exam || !currentUserId) return false
    if (userRole === 'admin') return true
    if (exam.created_by === currentUserId) return true
    return false
  }

  function openEditExam(exam) {
    setEditingExamId(exam.id)
    setEditExamName(exam.name ?? '')
    setEditExamType(exam.exam_type ?? 'written')
    setEditExamTypeId(exam.exam_type_id ?? '')
    setEditExamDate(exam.exam_date?.slice(0, 10) ?? '')
    setEditTotalQuestions(exam.total_questions != null ? String(exam.total_questions) : '')
    setEditTotalMarks(exam.total_marks != null ? String(exam.total_marks) : '')
    setEditSubjectRanges(
      (exam.exam_subjects ?? []).map((row) => ({
        subject_id: row.subject_id,
        subject_name: row.subjects?.name ?? 'Subject',
        question_from: row.question_from != null ? String(row.question_from) : '',
        question_to: row.question_to != null ? String(row.question_to) : '',
      }))
    )
    setActiveProfileExamId(null)
    setExamProfile(null)
    setError(null)

    supabase
      .from('exam_subjects')
      .select('subject_id, question_from, question_to, subjects(name)')
      .eq('exam_id', exam.id)
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error('Failed to load exam subjects:', fetchError)
          return
        }
        setEditSubjectRanges(
          (data ?? []).map((row) => ({
            subject_id: row.subject_id,
            subject_name: row.subjects?.name ?? 'Subject',
            question_from: row.question_from != null ? String(row.question_from) : '',
            question_to: row.question_to != null ? String(row.question_to) : '',
          }))
        )
      })
  }

  function updateEditSubjectRange(subjectId, field, value) {
    setEditSubjectRanges((prev) =>
      prev.map((row) =>
        row.subject_id === subjectId ? { ...row, [field]: value } : row
      )
    )
  }

  function closeEditExam() {
    setEditingExamId(null)
    setEditExamName('')
    setEditExamType('written')
    setEditExamTypeId('')
    setEditExamDate('')
    setEditTotalQuestions('')
    setEditTotalMarks('')
    setEditSubjectRanges([])
  }

  async function handleSaveExamEdit(examId) {
    const name = editExamName.trim()
    const total = parseInt(editTotalQuestions, 10)

    if (!name || !editExamDate || !total || total < 1 || !editExamTypeId) {
      setError('Please fill in all exam fields.')
      return
    }
    if (editExamType === 'written') {
      const marks = parseInt(editTotalMarks, 10)
      if (!marks || marks < 1) {
        setError('Please enter total marks for written exams.')
        return
      }
    }

    if (editSubjectRanges.length > 0) {
      for (const row of editSubjectRanges) {
        const from = parseInt(row.question_from, 10)
        const to = parseInt(row.question_to, 10)
        if (!from || !to || from < 1 || to < from || to > total) {
          setError(`Invalid question range for ${row.subject_name}. Must be between 1 and ${total}, with start <= end.`)
          return
        }
      }
    }

    setSavingExamEdit(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('exams')
        .update({
          name,
          exam_date: editExamDate,
          total_questions: total,
          total_marks: editExamType === 'written' ? parseInt(editTotalMarks, 10) : null,
          exam_type: editExamType,
          exam_type_id: editExamTypeId,
        })
        .eq('id', examId)

      if (updateError) throw new Error(updateError.message)

      for (const row of editSubjectRanges) {
        const { error: subjectUpdateError } = await supabase
          .from('exam_subjects')
          .update({
            question_from: parseInt(row.question_from, 10),
            question_to: parseInt(row.question_to, 10),
          })
          .eq('exam_id', examId)
          .eq('subject_id', row.subject_id)

        if (subjectUpdateError) throw new Error(subjectUpdateError.message)
      }

      closeEditExam()
      await fetchExams()
    } catch (err) {
      setError(err.message)
    }

    setSavingExamEdit(false)
  }

  async function handleAddExamType() {
    const name = newInstituteExamType.trim()
    if (!name || !instituteId) return

    setSavingExamType(true)
    setError(null)

    try {
      const user = await getAuthUser()
      const { error: insertError } = await supabase
        .from('exam_types')
        .insert({ name, institute_id: instituteId, created_by: user.id })

      if (insertError) throw new Error(insertError.message)

      setNewInstituteExamType('')
      await fetchExamTypes(instituteId)
    } catch (err) {
      setError(err.message)
    }

    setSavingExamType(false)
  }

  function openAssignClassesModal(examId) {
    setAssignClassesExamId(examId)
  }

  function closeAssignClassesModal() {
    setAssignClassesExamId(null)
  }

  async function handleToggleExamClass(exam, classId, className) {
    const isAssigned = (exam.exam_classes ?? []).some((ec) => ec.class_id === classId)

    if (isAssigned) {
      if (!window.confirm(`Remove "${className}" from this exam?`)) return
    }

    setAssigningClass(true)
    setError(null)

    try {
      if (isAssigned) {
        const { error: deleteError } = await supabase
          .from('exam_classes')
          .delete()
          .eq('exam_id', exam.id)
          .eq('class_id', classId)
        if (deleteError) throw new Error(deleteError.message)
      } else {
        const { error: insertError } = await supabase
          .from('exam_classes')
          .insert({ exam_id: exam.id, class_id: classId })
        if (insertError) throw new Error(insertError.message)
      }

      await fetchExams()
    } catch (err) {
      setError(err.message)
    }

    setAssigningClass(false)
  }

  function openAssignTeachersModal(examId) {
    setAssignTeachersExamId(examId)
  }

  function closeAssignTeachersModal() {
    setAssignTeachersExamId(null)
  }

  async function handleToggleExamTeacher(exam, teacherId, teacherName) {
    const isAssigned = (exam.exam_teachers ?? []).some((et) => et.teacher_id === teacherId)

    if (isAssigned) {
      if (!window.confirm(`Remove "${teacherName}" from this exam?`)) return
    }

    setAssigningTeacher(true)
    setError(null)

    try {
      if (isAssigned) {
        const { error: deleteError } = await supabase
          .from('exam_teachers')
          .delete()
          .eq('exam_id', exam.id)
          .eq('teacher_id', teacherId)
        if (deleteError) throw new Error(deleteError.message)
      } else {
        const { error: insertError } = await supabase
          .from('exam_teachers')
          .insert({ exam_id: exam.id, teacher_id: teacherId })
        if (insertError) throw new Error(insertError.message)

        const examTypeName = exam.exam_types?.name ?? exam.exam_type ?? 'exam'
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: teacherId,
          title: `Exam Assigned — ${exam.name}`,
          body: `You have been assigned to grade ${exam.name} (${examTypeName}). Please add questions and grade results.`,
          type: 'exam_assigned',
          is_read: false,
        })
        if (notifError) console.error('Exam assignment notification error:', notifError)
      }

      await fetchExams()
    } catch (err) {
      setError(err.message)
    }

    setAssigningTeacher(false)
  }

  async function handleDeleteExamType(typeId, typeName) {
    if (!window.confirm(`Delete exam type "${typeName}"?`)) return

    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('exam_types')
        .delete()
        .eq('id', typeId)

      if (deleteError) throw new Error(deleteError.message)

      if (selectedExamTypeId === typeId) {
        setSelectedExamTypeId('')
      }

      await fetchExamTypes(instituteId)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteExam(examId, examName, examType) {
    const confirmMessage = examType === 'written'
      ? 'Delete written exam? This will delete all questions and results for this exam.'
      : `Delete "${examName}"? This will delete all questions and results for this exam.`

    if (!window.confirm(confirmMessage)) return

    await supabase.from('topic_scores')
      .delete().eq('exam_id', examId)

    await supabase.from('omr_results')
      .delete().eq('exam_id', examId)

    await supabase.from('questions')
      .delete().eq('exam_id', examId)

    await supabase.from('exam_subjects')
      .delete().eq('exam_id', examId)

    await supabase.from('exam_classes')
      .delete().eq('exam_id', examId)

    const { error: deleteError } = await supabase.from('exams')
      .delete().eq('id', examId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setExams((prev) => prev.filter((e) => e.id !== examId))

    if (activeExam?.id === examId) closeQuestionsPanel()
    if (activeProfileExamId === examId) setActiveProfileExamId(null)
    if (aiExamId === examId) {
      setShowAIGenerator(false)
      setAiExamId(null)
    }
    await fetchExams()
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
      setCurrentUserId(user.id)
      setInstituteId(instId)

      if (instId) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('institute_id', instId)
          .order('name')
        if (classData) setClasses(classData)

        if (role === 'admin') {
          const { data: groupsData } = await supabase
            .from('class_groups')
            .select('id, name, class_group_members(class_id, classes(id, name))')
            .eq('institute_id', instId)
            .order('name')
          setClassGroups(groupsData ?? [])
        } else {
          setClassGroups([])
        }
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

      if (instId) {
        await fetchExamTypes(instId)
      }

      if (role === 'admin' && instId) {
        await fetchInstituteTeachers(instId)
      } else {
        setInstituteTeachers([])
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

  useEffect(() => {
    if (userRole !== 'admin' || selectedClassIds.length === 0) {
      setAdminClassSubjects([])
      return
    }

    async function loadClassSubjects() {
      const { data, error: fetchError } = await supabase
        .from('subject_classes')
        .select('class_id, subject_id, subjects(id, name)')
        .in('class_id', selectedClassIds)

      if (fetchError) {
        setError(fetchError.message)
        setAdminClassSubjects([])
        return
      }
      setAdminClassSubjects(data ?? [])
    }

    loadClassSubjects()
  }, [selectedClassIds, userRole])

  useEffect(() => {
    if (userRole !== 'admin') return

    const visible = filterClassesByGroup(classes, selectedGroupId, classGroups)
    setSelectedClassIds((prev) => prev.filter((id) => visible.some((c) => c.id === id)))
  }, [selectedGroupId, userRole, classes, classGroups])

  useEffect(() => {
    if (userRole !== 'admin') return

    const intersection = computeSubjectIntersection(adminClassSubjects, selectedClassIds)
    const validIds = new Set(intersection.map((s) => s.id))
    setSelectedSubjects((prev) => prev.filter((s) => validIds.has(s.subject_id)))
  }, [adminClassSubjects, selectedClassIds, userRole])

  function toggleSubject(subject) {
    setSelectedSubjects((prev) => {
      const exists = prev.find((s) => s.subject_id === subject.id)
      if (exists) {
        const next = prev.filter((s) => s.subject_id !== subject.id)
        if (next.length === 1) {
          return [{
            ...next[0],
            question_from: '1',
            question_to: next[0].question_to || totalQuestions || '',
          }]
        }
        return next
      }
      const next = [...prev, {
        subject_id: subject.id,
        name: subject.name,
        question_from: prev.length === 0 ? '1' : '',
        question_to: prev.length === 0 ? (totalQuestions || '') : '',
      }]
      if (next.length === 1) {
        return [{ ...next[0], question_from: '1', question_to: next[0].question_to || totalQuestions || '' }]
      }
      return next
    })
  }

  function updateSubjectRange(subject_id, field, value) {
    setSelectedSubjects((prev) =>
      prev.map((s) => s.subject_id === subject_id ? { ...s, [field]: value } : s)
    )
  }

  function getAdminExamScope() {
    if (selectedClassIds.length === 0) return null
    if (classes.length > 0 && selectedClassIds.length >= classes.length) return 'institute'
    if (selectedClassIds.length === 1) return 'class'
    return 'multiple'
  }

  function handleNextStep(e) {
    e.preventDefault()
    const name = examName.trim()
    const total = parseInt(totalQuestions, 10)

    if (!name || !examDate || !total || total < 1 || !selectedExamTypeId) {
      setError('Please fill in all exam fields.')
      return
    }
    if (examType === 'written') {
      const marks = parseInt(totalMarks, 10)
      if (!marks || marks < 1) {
        setError('Please enter total marks for written exams.')
        return
      }
    }
    if (selectedClassIds.length === 0) {
      setError('Please select at least one class.')
      return
    }

    setError(null)
    setCreateStep(2)
  }

  async function handleCreateExam(e) {
    e.preventDefault()
    const name = examName.trim()
    const total = parseInt(totalQuestions, 10)

    if (!name || !examDate || !total || total < 1 || !selectedExamTypeId) {
      setError('Please fill in all exam fields.')
      return
    }
    if (examType === 'written') {
      const marks = parseInt(totalMarks, 10)
      if (!marks || marks < 1) {
        setError('Please enter total marks for written exams.')
        return
      }
    }
    const examScope = userRole === 'teacher' ? 'class' : getAdminExamScope()

    if (!examScope || ((examScope === 'class' || examScope === 'multiple') && selectedClassIds.length === 0)) {
      setError('Please select at least one class.')
      return
    }
    if (userRole === 'admin' && computeSubjectIntersection(adminClassSubjects, selectedClassIds).length === 0) {
      setError('No common subjects found for selected classes.')
      return
    }
    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject.')
      return
    }
    if (selectedSubjects.length === 1) {
      const s = selectedSubjects[0]
      const to = parseInt(s.question_to, 10)
      if (!to || to < 1 || to > total) {
        setError(`Invalid total questions for ${s.name}. Must be between 1 and ${total}.`)
        return
      }
    } else {
      for (const s of selectedSubjects) {
        const from = parseInt(s.question_from, 10)
        const to = parseInt(s.question_to, 10)
        if (!from || !to || from < 1 || to < from || to > total) {
          setError(`Invalid question range for ${s.name}. Must be between 1 and ${total}, start <= end.`)
          return
        }
      }
    }

    setSavingExam(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const user = await getAuthUser()
      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          name,
          exam_date: examDate,
          total_questions: total,
          total_marks: examType === 'written' ? parseInt(totalMarks, 10) : null,
          created_by: user.id,
          scope: examScope,
          exam_type: examType,
          exam_type_id: selectedExamTypeId,
        })
        .select('id')
        .single()
      if (examErr) throw new Error(examErr.message)

      const examSubjectRows = selectedSubjects.map((s) => ({
        exam_id: newExam.id,
        subject_id: s.subject_id,
        question_from: selectedSubjects.length === 1 ? 1 : parseInt(s.question_from, 10),
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
      setSelectedExamTypeId('')
      setExamType('written')
      setExamDate('')
      setTotalQuestions('')
      setTotalMarks('')
      setSelectedSubjects([])
      setScope('class')
      setSelectedClassIds([])
      setSelectedGroupId('')
      setCreateStep(1)
      setSuccessMessage(`Exam "${name}" created successfully.`)
      await fetchExams()
    } catch (err) {
      setError(err.message)
    }
    setSavingExam(false)
  }

  function getChapterOptionLabel(chapter) {
    if (!chapter.class_id) return `${chapter.name} (General)`
    const className = activeExam?.exam_classes?.find(
      (ec) => ec.class_id === chapter.class_id
    )?.classes?.name
    const classIds = activeExam?.exam_classes?.map((ec) => ec.class_id) ?? []
    if (classIds.length > 1 && className) return `${chapter.name} (${className})`
    return chapter.name
  }

  function formatQuestionAssignment(q) {
    if (!q?.chapter_name) return `Q${q?.question_number ?? ''} — Unassigned`
    let label = `Q${q.question_number} → ${q.chapter_name} (Chapter)`
    if (q.topic_name) label += ` → ${q.topic_name} (Topic)`
    return label
  }

  function formatQuestionMapLabel(num, q) {
    if (!q?.chapter_name) return `Q${num} — Unassigned`
    let label = `Q${num} → ${q.chapter_name} (Chapter)`
    if (q.topic_name) label += ` → ${q.topic_name} (Topic)`
    return label
  }

  async function openQuestionsPanel(exam) {
    if (!canManageExamQuestions(exam)) {
      setError('You do not have permission to manage questions for this exam.')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setActiveExam(exam)
    setActiveSubjectId('')
    setActiveChapterId('')
    setActiveTopicId('')
    setChapterTopics([])
    setSelectedQNums([])
    setQuestionMap({})
    setShowWrittenQuestionText(false)
    const es = exam.exam_subjects ?? []
    setExamSubjects(es)
    const subjectIds = es.map((s) => s.subject_id)
    if (subjectIds.length === 0) { setChapters([]); return }

    const classIds = exam.exam_classes?.map((ec) => ec.class_id) ?? []
    const primaryClassId = classIds[0] ?? null

    let chapterQuery = supabase
      .from('chapters')
      .select('id, name, subject_id, class_id, subjects(name)')
      .in('subject_id', subjectIds)

    if (primaryClassId) {
      chapterQuery = chapterQuery.or(`class_id.eq.${primaryClassId},class_id.is.null`)
    }

    const { data, error: fetchError } = await chapterQuery.order('name')
    if (fetchError) { setError(fetchError.message); setChapters([]) }
    else {
      setChapters(data ?? [])
      if (es.length > 0) {
        setActiveSubjectId(es[0]?.subject_id ?? '')
      }
    }

    // Pre-populate questionMap with existing saved questions
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('question_number, chapter_id, topic_id, correct_answer, question_text, chapters(name), topics(name)')
      .eq('exam_id', exam.id)

    if (existingQuestions && existingQuestions.length > 0) {
      const allChapterIds = (data ?? []).map((c) => c.id)
      const map = {}
      existingQuestions.forEach((q) => {
        const idx = allChapterIds.indexOf(q.chapter_id)
        const color = TOPIC_COLORS[idx % TOPIC_COLORS.length]
        map[q.question_number] = {
          chapter_id: q.chapter_id,
          chapter_name: q.chapters?.name ?? '',
          topic_id: q.topic_id ?? null,
          topic_name: q.topics?.name ?? '',
          color,
          correct_answer: q.correct_answer,
          question_text: q.question_text ?? '',
        }
      })
      setQuestionMap(map)
      setShowWrittenQuestionText(
        existingQuestions.some((q) => q.question_text?.trim())
      )
    }

    setTimeout(() => {
      questionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function closeQuestionsPanel() {
    setActiveExam(null)
    setExamSubjects([])
    setChapters([])
    setChapterTopics([])
    setActiveSubjectId('')
    setActiveChapterId('')
    setActiveTopicId('')
    setSelectedQNums([])
    setQuestionMap({})
    setShowWrittenQuestionText(false)
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

  function getChapterColor(chapter_id) {
    const allChapterIds = chapters.map((c) => c.id)
    const idx = allChapterIds.indexOf(chapter_id)
    return TOPIC_COLORS[idx % TOPIC_COLORS.length]
  }

  async function loadChapterTopics(chapterId) {
    if (!chapterId) {
      setChapterTopics([])
      return
    }
    const { data, error: fetchError } = await supabase
      .from('topics')
      .select('id, name, chapter_id')
      .eq('chapter_id', chapterId)
      .order('name')
    if (fetchError) {
      setError(fetchError.message)
      setChapterTopics([])
    } else {
      setChapterTopics(data ?? [])
    }
  }

  function assignChapterToSelected() {
    if (!activeChapterId || selectedQNums.length === 0) return
    const chapter = chapters.find((c) => c.id === activeChapterId)
    const topic = activeTopicId
      ? chapterTopics.find((t) => t.id === activeTopicId)
      : null
    const color = getChapterColor(activeChapterId)
    setQuestionMap((prev) => {
      const next = { ...prev }
      selectedQNums.forEach((num) => {
        next[num] = {
          ...next[num],
          chapter_id: activeChapterId,
          chapter_name: chapter?.name ?? '',
          topic_id: topic?.id ?? null,
          topic_name: topic?.name ?? '',
          color,
          correct_answer: next[num]?.correct_answer ?? '',
          question_text: next[num]?.question_text ?? '',
        }
      })
      return next
    })
    setSelectedQNums([])
  }

  function updateQuestionText(qNum, text) {
    setQuestionMap((prev) => ({
      ...prev,
      [qNum]: { ...prev[qNum], question_text: text },
    }))
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
    return getAllQuestionNums().filter((n) => !questionMap[n]?.chapter_id).length
  }

  function getMissingAnswerCount() {
    return getAllQuestionNums().filter((n) => !questionMap[n]?.correct_answer).length
  }

  async function handleSaveAllQuestions() {
    if (!activeExam) return
    if (!canManageExamQuestions(activeExam)) {
      setError('You do not have permission to manage questions for this exam.')
      return
    }

    const allNums = getAllQuestionNums()
    const unassigned = allNums.filter((n) => !questionMap[n]?.chapter_id)
    if (unassigned.length > 0) {
      setError(`${unassigned.length} question(s) still have no chapter: Q${unassigned.join(', Q')}`)
      return
    }
    const isWritten = activeExam.exam_type === 'written'
    if (!isWritten) {
      const noAnswer = allNums.filter((n) => !questionMap[n]?.correct_answer)
      if (noAnswer.length > 0) {
        setError(`${noAnswer.length} question(s) still have no answer: Q${noAnswer.join(', Q')}`)
        return
      }
    }

    setSavingQuestions(true)
    setError(null)

    const payload = allNums.map((num) => {
      const row = {
        exam_id: activeExam.id,
        question_number: num,
        chapter_id: questionMap[num].chapter_id,
        topic_id: questionMap[num].topic_id ?? null,
      }
      if (isWritten) {
        row.correct_answer = null
        const text = questionMap[num].question_text?.trim()
        row.question_text = text || null
      } else {
        row.correct_answer = questionMap[num].correct_answer
      }
      return row
    })

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
      .select('id, question_number, correct_answer, question_text, option_a, option_b, option_c, option_d, difficulty, chapter_id, topic_id, chapters(name, subjects(name)), topics(name)')
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
    setAiChapterAllocations({})
    setAiSelectedChapters({})
    setAiTotalQuestions(String(exam.total_questions ?? ''))
    setAiStep(2)
    setShowAIGenerator(true)

    const examSubjects = exam.exam_subjects ?? []
    const subjectIds = examSubjects.map((es) => es.subject_id)

    if (subjectIds.length === 0) return

    const classId = exam.exam_classes?.[0]?.class_id

    let chapterQuery = supabase
      .from('chapters')
      .select('id, name, subject_id, topics(id, name)')
      .in('subject_id', subjectIds)
      .order('name')

    if (classId) {
      chapterQuery = chapterQuery.or(`class_id.eq.${classId},class_id.is.null`)
    }

    const { data: chaptersData } = await chapterQuery

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
      chapters: chaptersData?.filter((c) => c.subject_id === es.subject_id) ?? [],
    }))

    setAiExamSubjects(subjects)
  }

  async function handleGenerateQuestions() {
    setGenerating(true)
    setAiError(null)

    try {
      const allQuestions = []

      for (const subject of aiExamSubjects) {
        const allocations = []

        for (const chapter of subject.chapters) {
          const chapterTopicsSelected = (chapter.topics ?? []).filter(
            (t) => aiSelectedTopics[t.id] && aiTopicAllocations[t.id] > 0
          )

          if (chapterTopicsSelected.length > 0) {
            chapterTopicsSelected.forEach((t) => {
              allocations.push({
                chapter_id: chapter.id,
                chapter_name: chapter.name,
                topic_id: t.id,
                topic_name: t.name,
                count: aiTopicAllocations[t.id] ?? 1,
              })
            })
          } else if (aiSelectedChapters[chapter.id] && aiChapterAllocations[chapter.id] > 0) {
            allocations.push({
              chapter_id: chapter.id,
              chapter_name: chapter.name,
              topic_id: null,
              topic_name: chapter.name,
              count: aiChapterAllocations[chapter.id] ?? 1,
            })
          }
        }

        if (allocations.length === 0) continue

        const chapterContext = allocations
          .map((a) => a.chapter_name)
          .filter((name, i, arr) => arr.indexOf(name) === i)
          .join(', ')

        const topicAllocList = allocations.map((a) => ({
          chapter_id: a.chapter_id,
          topic_id: a.topic_id,
          topic_name: a.topic_name,
          count: a.count,
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
        chapter_id: q.chapter_id,
        topic_id: q.topic_id ?? null,
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
      setAiStep(2)
      setSuccessMessage(`${rows.length} AI questions saved to exam!`)
      await fetchExams()
      if (activeProfileExamId === aiExamId) {
        const { data: refreshed } = await supabase
          .from('questions')
          .select('id, question_number, correct_answer, question_text, option_a, option_b, option_c, option_d, difficulty, chapter_id, topic_id, chapters(name, subjects(name)), topics(name)')
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
  const activeSubjectChapters = chapters.filter((c) => c.subject_id === activeSubjectId)
  const gridNums = getActiveSubjectRange()
  const allNums = activeExam ? getAllQuestionNums() : []
  const unassignedCount = activeExam ? getUnassignedCount() : 0
  const missingAnswerCount = activeExam ? getMissingAnswerCount() : 0
  const isWrittenExam = activeExam?.exam_type === 'written'
  const relevantSubjectIds = userRole === 'teacher'
    ? teacherAssignments
        .filter((a) => selectedClassIds.includes(a.class_id))
        .map((a) => a.subject_id)
    : []

  const adminDisplayClasses = useMemo(
    () => filterClassesByGroup(classes, selectedGroupId, classGroups),
    [classes, selectedGroupId, classGroups],
  )

  const adminIntersectionSubjects = useMemo(
    () => computeSubjectIntersection(adminClassSubjects, selectedClassIds),
    [adminClassSubjects, selectedClassIds],
  )

  const filteredSubjects = userRole === 'teacher'
    ? subjects.filter((s) => relevantSubjectIds.includes(s.id))
    : userRole === 'admin'
      ? adminIntersectionSubjects
      : subjects

  const displayClasses = userRole === 'admin' ? adminDisplayClasses : availableClasses

  const filteredExams = useMemo(() => {
    let list = exams

    if (examListTypeFilter) {
      list = list.filter((exam) => exam.exam_type_id === examListTypeFilter)
    }

    if (examListClassFilter) {
      list = list.filter((exam) =>
        (exam.exam_classes ?? []).some((ec) => ec.class_id === examListClassFilter)
      )
    }

    return list
  }, [exams, examListTypeFilter, examListClassFilter])

  const assignClassesExam = assignClassesExamId
    ? exams.find((e) => e.id === assignClassesExamId)
    : null

  const assignTeachersExam = assignTeachersExamId
    ? exams.find((e) => e.id === assignTeachersExamId)
    : null

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-6">Exams</h1>

      <form
        onSubmit={(e) => {
          if (userRole === 'admin' && createStep === 1) {
            handleNextStep(e)
            return
          }
          handleCreateExam(e)
        }}
        className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">
          Create Exam
          {userRole === 'admin' && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-[#A8A8A8]">
              Step {createStep} of 2
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {userRole === 'admin' && createStep === 1 && (
            <>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Exam name</label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="JEE Mains Mock Test 1"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="institute-exam-type" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                  Exam Type
                </label>
                <select
                  id="institute-exam-type"
                  required
                  value={selectedExamTypeId}
                  onChange={(e) => setSelectedExamTypeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                >
                  <option value="">Select exam type</option>
                  {instituteExamTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {instituteExamTypes.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8] mt-1">Add exam types below before creating an exam.</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Format</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'written', label: 'Written' },
                    { value: 'mcq', label: 'MCQ' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-1 min-w-[120px] text-center justify-center items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        examType === opt.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="examType"
                        value={opt.value}
                        checked={examType === opt.value}
                        onChange={() => setExamType(opt.value)}
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {examType === 'written' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="Total marks (e.g. 100)"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="exam-group" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                  Select Group (optional)
                </label>
                <select
                  id="exam-group"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                >
                  <option value="">All Classes</option>
                  {classGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Select Classes</label>
                <div className="flex flex-wrap gap-2">
                  {adminDisplayClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        selectedClassIds.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(c.id)}
                        onChange={() => setSelectedClassIds((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((id) => id !== c.id)
                            : [...prev, c.id]
                        )}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shrink-0"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {adminDisplayClasses.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">No classes found. Create classes first.</p>
                )}
                {selectedClassIds.length > 0 && classes.length > 0 && selectedClassIds.length >= classes.length && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">All classes selected — exam will be institute-wide.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Exam date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Total questions</label>
                <input
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  placeholder="90"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 transition-colors"
                >
                  Next: Subject & Questions →
                </button>
              </div>
            </>
          )}

          {userRole === 'admin' && createStep === 2 && (
            <>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => { setCreateStep(1); setError(null) }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  ← Back to exam details
                </button>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Subjects & Question Ranges</label>
                {selectedClassIds.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">Select one or more classes first.</p>
                ) : adminIntersectionSubjects.length === 0 ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    No common subjects found for selected classes
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredSubjects.map((s) => {
                      const selected = selectedSubjects.find((ss) => ss.subject_id === s.id)
                      return (
                        <div key={s.id} className="flex flex-wrap items-center gap-2">
                          <label className={`flex flex-1 min-w-[100px] text-sm items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8] hover:border-gray-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={() => toggleSubject(s)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-600 shrink-0"
                            />
                            {s.name}
                          </label>
                          {selected && (
                            selectedSubjects.length === 1 ? (
                              <>
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Total Questions</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={parseInt(totalQuestions, 10) || undefined}
                                  value={selected.question_to || totalQuestions}
                                  onChange={(e) => {
                                    updateSubjectRange(s.id, 'question_from', '1')
                                    updateSubjectRange(s.id, 'question_to', e.target.value)
                                  }}
                                  placeholder={totalQuestions || '90'}
                                  className="w-20 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Q from</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={selected.question_from}
                                  onChange={(e) => updateSubjectRange(s.id, 'question_from', e.target.value)}
                                  placeholder="1"
                                  className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">to</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={selected.question_to}
                                  onChange={(e) => updateSubjectRange(s.id, 'question_to', e.target.value)}
                                  placeholder="30"
                                  className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                              </>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateStep(1); setError(null) }}
                  className="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] font-medium px-4 py-2 rounded-lg hover:shadow-md transition-shadow"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={savingExam}
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {savingExam ? 'Saving…' : 'Save Exam'}
                </button>
              </div>
            </>
          )}

          {userRole === 'teacher' && (
            <>
              <div className="sm:col-span-2">
                <label htmlFor="institute-exam-type" className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                  Exam Type
                </label>
                <select
                  id="institute-exam-type"
                  required
                  value={selectedExamTypeId}
                  onChange={(e) => setSelectedExamTypeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                >
                  <option value="">Select exam type</option>
                  {instituteExamTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Exam name</label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="JEE Mains Mock Test 1"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Format</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'written', label: 'Written' },
                    { value: 'mcq', label: 'MCQ' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-1 min-w-[120px] text-center justify-center items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        examType === opt.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="examType"
                        value={opt.value}
                        checked={examType === opt.value}
                        onChange={() => setExamType(opt.value)}
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Select Classes</label>
                <div className="flex flex-wrap gap-2">
                  {displayClasses.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        selectedClassIds.includes(c.id)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(c.id)}
                        onChange={() => setSelectedClassIds((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((id) => id !== c.id)
                            : [...prev, c.id]
                        )}
                        className="hidden"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {displayClasses.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">No assigned classes found.</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">Subjects & Question Ranges</label>
                {selectedClassIds.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">Select one or more classes to see subjects.</p>
                ) : filteredSubjects.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No subjects found. Add subjects on the Subjects page first.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredSubjects.map((s) => {
                      const selected = selectedSubjects.find((ss) => ss.subject_id === s.id)
                      return (
                        <div key={s.id} className="flex flex-wrap items-center gap-2">
                          <label className={`flex flex-1 min-w-[100px] text-sm items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8] hover:border-gray-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={() => toggleSubject(s)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-600 shrink-0"
                            />
                            {s.name}
                          </label>
                          {selected && (
                            selectedSubjects.length === 1 ? (
                              <>
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Total Questions</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={parseInt(totalQuestions, 10) || undefined}
                                  value={selected.question_to || totalQuestions}
                                  onChange={(e) => {
                                    updateSubjectRange(s.id, 'question_from', '1')
                                    updateSubjectRange(s.id, 'question_to', e.target.value)
                                  }}
                                  placeholder={totalQuestions || '90'}
                                  className="w-20 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">Q from</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={selected.question_from}
                                  onChange={(e) => updateSubjectRange(s.id, 'question_from', e.target.value)}
                                  placeholder="1"
                                  className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">to</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={selected.question_to}
                                  onChange={(e) => updateSubjectRange(s.id, 'question_to', e.target.value)}
                                  placeholder="30"
                                  className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                />
                              </>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Exam date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Total questions</label>
                <input
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  placeholder="90"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                />
              </div>

              {examType === 'written' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="Total marks (e.g. 100)"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingExam}
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {savingExam ? 'Saving…' : 'Save Exam'}
                </button>
              </div>
            </>
          )}

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

      <section className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">Exam Types</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {instituteExamTypes.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No exam types yet. Add one below.</p>
          ) : (
            instituteExamTypes.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] text-sm"
              >
                {t.name}
                {(userRole === 'admin' || t.created_by === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteExamType(t.id, t.name)}
                    className="text-gray-400 dark:text-[#A8A8A8] hover:text-red-600 font-medium leading-none"
                    aria-label={`Delete ${t.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newInstituteExamType}
            onChange={(e) => setNewInstituteExamType(e.target.value)}
            placeholder="New exam type name"
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
          />
          <button
            type="button"
            onClick={handleAddExamType}
            disabled={savingExamType || !newInstituteExamType.trim()}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm shrink-0"
          >
            {savingExamType ? 'Adding…' : 'Add'}
          </button>
        </div>
      </section>

      {assignTeachersExam && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeAssignTeachersModal}
        >
          <div
            className="bg-white dark:bg-[#1C1C1C] rounded-xl shadow-lg max-w-md w-full p-5 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Assign Teachers</h3>
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-0.5">{assignTeachersExam.name}</p>
              </div>
              <button
                type="button"
                onClick={closeAssignTeachersModal}
                className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {instituteTeachers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No teachers found.</p>
            ) : (
              <ul className="overflow-y-auto flex-1 divide-y divide-gray-200 dark:divide-gray-700 -mx-1">
                {instituteTeachers.map((teacher) => {
                  const isAssigned = (assignTeachersExam.exam_teachers ?? []).some(
                    (et) => et.teacher_id === teacher.id
                  )
                  return (
                    <li key={teacher.id}>
                      <button
                        type="button"
                        disabled={assigningTeacher}
                        onClick={() =>
                          handleToggleExamTeacher(assignTeachersExam, teacher.id, teacher.name)
                        }
                        className={`w-full flex items-center justify-between px-3 py-3 text-sm text-left hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors disabled:opacity-50 ${
                          isAssigned ? 'text-gray-900 dark:text-[#FFFFFF] font-medium' : 'text-gray-700 dark:text-[#A8A8A8]'
                        }`}
                      >
                        <span>{teacher.name}</span>
                        {isAssigned && (
                          <span className="text-green-600 text-xs font-semibold">✓ Assigned</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {assignClassesExam && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeAssignClassesModal}
        >
          <div
            className="bg-white dark:bg-[#1C1C1C] rounded-xl shadow-lg max-w-md w-full p-5 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">Assign to Class</h3>
                <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mt-0.5">{assignClassesExam.name}</p>
              </div>
              <button
                type="button"
                onClick={closeAssignClassesModal}
                className="text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8] text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No classes found.</p>
            ) : (
              <ul className="overflow-y-auto flex-1 divide-y divide-gray-200 dark:divide-gray-700 -mx-1">
                {classes.map((cls) => {
                  const isAssigned = (assignClassesExam.exam_classes ?? []).some(
                    (ec) => ec.class_id === cls.id
                  )
                  return (
                    <li key={cls.id}>
                      <button
                        type="button"
                        disabled={assigningClass}
                        onClick={() => handleToggleExamClass(assignClassesExam, cls.id, cls.name)}
                        className={`w-full flex items-center justify-between px-3 py-3 text-sm text-left hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors disabled:opacity-50 ${
                          isAssigned ? 'text-gray-900 dark:text-[#FFFFFF] font-medium' : 'text-gray-700 dark:text-[#A8A8A8]'
                        }`}
                      >
                        <span>{cls.name}</span>
                        {isAssigned && (
                          <span className="text-green-600 text-xs font-semibold">✓ Assigned</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-3">All Exams</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide -mx-1 px-1">
          <button
            type="button"
            onClick={() => setExamListTypeFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              examListTypeFilter === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
            }`}
          >
            All Types
          </button>
          {instituteExamTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setExamListTypeFilter(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                examListTypeFilter === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:bg-gray-200'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="mb-4">
          <select
            value={examListClassFilter}
            onChange={(e) => setExamListClassFilter(e.target.value)}
            className="w-full md:w-64 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1C1C1C] px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader size={40} />
          </div>
        ) : filteredExams.length === 0 ? (
          <p className="text-gray-500 dark:text-[#A8A8A8] text-sm">
            {exams.length === 0
              ? 'No exams yet. Create one above.'
              : 'No exams match the selected filters.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredExams.map((exam) => (
              <li key={exam.id}>
                <div className="bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm relative">
                  {userRole === 'admin' && (
                    <span
                      className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium border ${
                        exam.creator_role === 'teacher'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {exam.creator_role === 'teacher'
                        ? `📋 Created by ${exam.creator_name ?? 'Teacher'}`
                        : '📋 Created by Admin'}
                    </span>
                  )}
                  {showAssignedByCreatorBadge(exam) && (
                    <span className="absolute top-3 right-3 text-xs bg-slate-50 text-slate-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                      📋 Assigned by {exam.creator_name ?? (exam.creator_role === 'admin' ? 'Admin' : 'Teacher')}
                    </span>
                  )}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 pr-28">
                      <button
                        type="button"
                        onClick={() => toggleExamProfile(exam)}
                        className="font-semibold text-gray-900 dark:text-[#FFFFFF] hover:text-blue-600 text-left text-sm"
                      >
                        {exam.name}
                      </button>
                      {exam.exam_types?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium border border-current border border-current">
                          {exam.exam_types.name}
                        </span>
                      )}
                    </div>
                    {(exam.scope === 'institute' || (exam.exam_classes?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {exam.scope === 'institute' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium border border-current">
                            Whole Institute
                          </span>
                        )}
                        {exam.exam_classes?.map((ec) => (
                          ec.classes?.name ? (
                            <span
                              key={ec.class_id}
                              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#A8A8A8] font-medium border border-current"
                            >
                              {ec.classes.name}
                            </span>
                          ) : null
                        ))}
                      </div>
                    )}
                    {(exam.exam_teachers?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {exam.exam_teachers.map((et) => (
                          et.users?.name ? (
                            <span
                              key={et.teacher_id}
                              className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-current"
                            >
                              {et.users.name}
                            </span>
                          ) : null
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 flex-wrap items-center">
                      {canManageExamQuestions(exam) && (
                        <button
                          type="button"
                          onClick={() => activeExam?.id === exam.id ? closeQuestionsPanel() : openQuestionsPanel(exam)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {activeExam?.id === exam.id ? 'Close' : 'Add Questions'}
                        </button>
                      )}
                      {!showAssignedByAdminBadge(exam) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openAIGenerator(exam)}
                            className="text-sm font-medium text-purple-600 hover:text-purple-700"
                          >
                            🤖 Generate with AI
                          </button>
                          <button
                            type="button"
                            onClick={() => openAssignClassesModal(exam.id)}
                            className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
                          >
                            Assign to Class
                          </button>
                          {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={() => openAssignTeachersModal(exam.id)}
                              className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262626] px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
                            >
                              Assign Teachers
                            </button>
                          )}
                        </>
                      )}
                      {canEditExam(exam) && (
                        <button
                          type="button"
                          onClick={() => openEditExam(exam)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteExam(exam) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(exam.id, exam.name, exam.exam_type)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                      {exam.exam_subjects?.map((es) => {
                        const name = es.subjects?.name
                        const range = es.question_from && es.question_to
                          ? ` (Q${es.question_from}–Q${es.question_to})`
                          : ''
                        return name ? name + range : null
                      }).filter(Boolean).join(', ') || 'No subjects'}{' '}
                      · {formatDate(exam.exam_date)} · {exam.total_questions} questions
                      {exam.exam_type === 'written' && exam.total_marks != null
                        ? ` · Total Marks: ${exam.total_marks}`
                        : ''}
                    </p>
                  </div>
                </div>

                {editingExamId === exam.id && (
                  <div className="mt-1 bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-4">Edit Exam</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                          Exam name
                        </label>
                        <input
                          type="text"
                          value={editExamName}
                          onChange={(e) => setEditExamName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                          Exam Type
                        </label>
                        <select
                          value={editExamTypeId}
                          onChange={(e) => setEditExamTypeId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                        >
                          <option value="">Select exam type</option>
                          {instituteExamTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                          Format
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 'written', label: 'Written' },
                            { value: 'mcq', label: 'MCQ' },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className={`flex flex-1 min-w-[120px] text-center justify-center items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                                editExamType === opt.value
                                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-[#A8A8A8]'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`editExamType-${exam.id}`}
                                value={opt.value}
                                checked={editExamType === opt.value}
                                onChange={() => setEditExamType(opt.value)}
                                className="hidden"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {editExamType === 'written' && (
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                            Total Marks
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editTotalMarks}
                            onChange={(e) => setEditTotalMarks(e.target.value)}
                            placeholder="Total marks (e.g. 100)"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                          Exam date
                        </label>
                        <input
                          type="date"
                          value={editExamDate}
                          onChange={(e) => setEditExamDate(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-1">
                          Total questions
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editTotalQuestions}
                          onChange={(e) => setEditTotalQuestions(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] mb-2">
                          Subject Question Ranges
                        </h4>
                        {editSubjectRanges.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                            No subjects assigned to this exam.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {editSubjectRanges.map((row) => (
                              <div
                                key={row.subject_id}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#262626] px-3 py-2"
                              >
                                <span className="text-sm font-medium text-gray-900 dark:text-[#FFFFFF] min-w-[120px]">
                                  {row.subject_name}
                                </span>
                                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#A8A8A8]">
                                  Q from
                                  <input
                                    type="number"
                                    min={1}
                                    value={row.question_from}
                                    onChange={(e) =>
                                      updateEditSubjectRange(row.subject_id, 'question_from', e.target.value)
                                    }
                                    className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] dark:bg-[#1C1C1C]"
                                  />
                                </label>
                                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#A8A8A8]">
                                  Q to
                                  <input
                                    type="number"
                                    min={1}
                                    value={row.question_to}
                                    onChange={(e) =>
                                      updateEditSubjectRange(row.subject_id, 'question_to', e.target.value)
                                    }
                                    className="w-16 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-[#FFFFFF] dark:bg-[#1C1C1C]"
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveExamEdit(exam.id)}
                          disabled={savingExamEdit}
                          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {savingExamEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={closeEditExam}
                          className="text-gray-600 dark:text-[#A8A8A8] font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeProfileExamId === exam.id && (
                  <div className="mt-1 bg-white dark:bg-[#1C1C1C] rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
                        Exam Profile — {exam.name}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProfileExamId(null)
                          setExamProfile(null)
                        }}
                        className="text-sm text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:text-[#A8A8A8]"
                      >
                        Close
                      </button>
                    </div>

                    {exam.exam_type === 'written' && exam.total_marks != null && (
                      <p className="text-sm text-gray-700 dark:text-[#A8A8A8] mb-4">
                        Total Marks: <span className="font-semibold">{exam.total_marks}</span>
                      </p>
                    )}

                    {loadingProfile ? (
                      <div className="flex justify-center items-center h-32">
                        <Loader size={40} />
                      </div>
                    ) : !examProfile?.length ? (
                      <p className="text-sm text-gray-400 dark:text-[#A8A8A8]">No questions added yet.</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-4">
                          {examProfile.length} question{examProfile.length !== 1 ? 's' : ''} saved
                        </p>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {examProfile.map((q) => (
                            <div
                              key={q.id}
                              className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-xs text-blue-600 font-medium">
                                  {formatQuestionAssignment({
                                    question_number: q.question_number,
                                    chapter_name: q.chapters?.name,
                                    topic_name: q.topics?.name,
                                  })}
                                </span>
                                {exam.exam_type === 'written' && q.question_text && (
                                  <p className="text-xs text-gray-500 dark:text-[#A8A8A8] w-full">{q.question_text}</p>
                                )}
                                {q.difficulty && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] capitalize">
                                    {q.difficulty}
                                  </span>
                                )}
                                {exam.exam_type !== 'written' && (
                                  <span className="text-xs text-green-600 font-medium ml-auto">
                                    Answer: {q.correct_answer}
                                  </span>
                                )}
                              </div>
                              {exam.exam_type !== 'written' && (
                                <>
                                  {q.question_text ? (
                                    <p className="text-sm text-gray-900 dark:text-[#FFFFFF] mb-2">{q.question_text}</p>
                                  ) : (
                                    <p className="text-sm text-gray-400 dark:text-[#A8A8A8] italic mb-2">No question text</p>
                                  )}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
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
                                              : 'text-gray-600 dark:text-[#A8A8A8]'
                                          }`}
                                        >
                                          {letter}. {value}
                                        </p>
                                      )
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeExam?.id === exam.id && canManageExamQuestions(exam) && (
                  <div
                    ref={questionsPanelRef}
                    className="mt-2 bg-white dark:bg-[#1C1C1C] rounded-xl border border-blue-200 p-6 shadow-sm"
                  >
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] mb-1">
                      Add Questions — {activeExam.name}
                    </h2>
                    {primaryClassName && (
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-4">
                        Chapters for {primaryClassName}
                        {examClassCount > 1 && ' (first linked class)'}
                      </p>
                    )}
                    {!primaryClassName && activeExam.scope !== 'institute' && (
                      <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-4">No class linked — showing all chapters.</p>
                    )}

                    {examSubjects.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-[#A8A8A8]">No subjects linked to this exam.</p>
                    )}

                    {examSubjects.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-3 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">Subject</label>
                            <select
                              value={activeSubjectId}
                              onChange={(e) => {
                                setActiveSubjectId(e.target.value)
                                setActiveChapterId('')
                                setActiveTopicId('')
                                setChapterTopics([])
                                setSelectedQNums([])
                              }}
                              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
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
                              <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">Select Chapter</label>
                              <select
                                value={activeChapterId}
                                onChange={(e) => {
                                  const chapterId = e.target.value
                                  setActiveChapterId(chapterId)
                                  setActiveTopicId('')
                                  setSelectedQNums([])
                                  loadChapterTopics(chapterId)
                                }}
                                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                              >
                                <option value="">Select chapter</option>
                                {activeSubjectChapters.map((c) => (
                                  <option key={c.id} value={c.id}>{getChapterOptionLabel(c)}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeChapterId && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">Topic (optional)</label>
                              <select
                                value={activeTopicId}
                                onChange={(e) => { setActiveTopicId(e.target.value); setSelectedQNums([]) }}
                                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                              >
                                <option value="">Chapter level only (no topic)</option>
                                {chapterTopics.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {activeSubjectId && (
                          <>
                            <p className="text-xs text-gray-500 dark:text-[#A8A8A8] mb-2">
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
                                        : assigned?.chapter_id
                                        ? `${assigned.color} border-current`
                                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#262626] text-gray-600 dark:text-[#A8A8A8] hover:border-gray-400'
                                    }`}
                                    title={assigned?.chapter_name ? formatQuestionMapLabel(num, assigned) : 'Unassigned'}
                                  >
                                    {num}
                                  </button>
                                )
                              })}
                            </div>

                            {activeSubjectChapters.some((c) =>
                              Object.values(questionMap).some((q) => q.chapter_id === c.id)
                            ) && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {activeSubjectChapters.map((c) => {
                                  const count = gridNums.filter((n) => questionMap[n]?.chapter_id === c.id).length
                                  if (count === 0) return null
                                  return (
                                    <span key={c.id} className={`text-xs px-2 py-1 rounded-full border ${getChapterColor(c.id)}`}>
                                      {getChapterOptionLabel(c)} ({count})
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={assignChapterToSelected}
                              disabled={!activeChapterId || selectedQNums.length === 0}
                              className="mb-4 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Assign {selectedQNums.length > 0 ? `${selectedQNums.length} questions` : 'selected'} to chapter
                            </button>

                            {gridNums.some((n) => questionMap[n]?.chapter_id) && (
                              <div className="mb-4 border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                                <p className="text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">Assigned questions</p>
                                <ul className="space-y-1 max-h-40 overflow-y-auto">
                                  {gridNums
                                    .filter((n) => questionMap[n]?.chapter_id)
                                    .map((num) => (
                                      <li key={num} className="text-xs text-gray-700 dark:text-[#A8A8A8]">
                                        {formatQuestionMapLabel(num, questionMap[num])}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}

                        {allNums.length > 0 && isWrittenExam && (
                          <div className="mb-4">
                            {!showWrittenQuestionText ? (
                              <button
                                type="button"
                                onClick={() => setShowWrittenQuestionText(true)}
                                className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8] border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-4 py-2 rounded-lg hover:shadow-md transition-shadow"
                              >
                                ✏️ Add Question Text (optional)
                              </button>
                            ) : (
                              <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8]">Written Questions</p>
                                  <button
                                    type="button"
                                    onClick={() => setShowWrittenQuestionText(false)}
                                    className="text-xs font-medium text-gray-500 dark:text-[#A8A8A8] hover:text-gray-700 dark:hover:text-[#FFFFFF]"
                                  >
                                    Hide
                                  </button>
                                </div>
                                <div className="space-y-3 max-h-72 overflow-y-auto">
                                  {allNums.map((num) => {
                                    const q = questionMap[num]
                                    return (
                                      <div
                                        key={num}
                                        className={`p-3 rounded-lg border ${
                                          !q?.chapter_id
                                            ? 'border-orange-200 bg-orange-50'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1C1C1C]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <span className="text-xs font-medium text-gray-700 dark:text-[#A8A8A8]">Q{num}</span>
                                          {q?.chapter_name && (
                                            <span className="text-xs text-blue-600">
                                              {q.chapter_name} (Chapter)
                                              {q.topic_name ? ` — ${q.topic_name} (Topic)` : ''}
                                            </span>
                                          )}
                                        </div>
                                        <input
                                          type="text"
                                          value={q?.question_text ?? ''}
                                          onChange={(e) => updateQuestionText(num, e.target.value)}
                                          placeholder="Question text (optional)"
                                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder:text-gray-400 dark:placeholder-[#A8A8A8] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-[#262626]"
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {allNums.length > 0 && !isWrittenExam && (
                          <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-medium text-gray-700 dark:text-[#A8A8A8]">Correct Answers</p>
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
                                      !q?.chapter_id ? 'border-orange-200 bg-orange-50' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1C1C1C]'
                                    }`}
                                  >
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                      <span className="text-xs font-medium text-gray-500 dark:text-[#A8A8A8] w-6">Q{num}</span>
                                      {q?.chapter_name && (
                                        <span className="text-[10px] text-blue-600 max-w-[80px] leading-tight">
                                          {q.chapter_name}
                                          {q.topic_name ? ` / ${q.topic_name}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    <select
                                      value={q?.correct_answer ?? ''}
                                      onChange={(e) => updateAnswer(num, e.target.value)}
                                      className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-1 py-1 text-xs text-gray-900 dark:text-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-blue-600 dark:bg-[#262626]"
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
                          disabled={
                            savingQuestions
                            || unassignedCount > 0
                            || (!isWrittenExam && missingAnswerCount > 0)
                          }
                          className="bg-gray-900 text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingQuestions
                            ? 'Saving…'
                            : unassignedCount > 0
                            ? `${unassignedCount} questions need chapters`
                            : !isWrittenExam && missingAnswerCount > 0
                            ? `${missingAnswerCount} questions need answers`
                            : 'Save All Questions'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {showAIGenerator && aiExamId === exam.id && (
                  <div className="mt-2 bg-white dark:bg-[#1C1C1C] rounded-xl border border-purple-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
                        🤖 Generate Questions with AI
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAIGenerator(false)
                          setAiExamId(null)
                          setGeneratedQuestions([])
                          setAiStep(2)
                        }}
                        className="text-sm text-gray-400 dark:text-[#A8A8A8] hover:text-gray-600 dark:text-[#A8A8A8]"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 mb-4">
                      {['Chapters', 'Settings', 'Review'].map((s, i) => {
                        const stepNum = i + 2
                        return (
                        <div key={s} className="flex items-center gap-1 shrink-0">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              aiStep > stepNum
                                ? 'bg-green-500 text-white'
                                : aiStep === stepNum
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 text-gray-500 dark:text-[#A8A8A8]'
                            }`}
                          >
                            {aiStep > stepNum ? '✓' : i + 1}
                          </span>
                          <span
                            className={`text-xs ${
                              aiStep === stepNum ? 'text-purple-600 font-medium' : 'text-gray-400 dark:text-[#A8A8A8]'
                            }`}
                          >
                            {s}
                          </span>
                          {i < 2 && <span className="text-gray-300 text-xs">›</span>}
                        </div>
                        )
                      })}
                    </div>

                    {aiStep === 2 && (
                      <div className="space-y-5">
                        {aiExamSubjects.map((subject) => {
                          const subjectTotal = subject.range_to - subject.range_from + 1
                          const subjectAllocated = subject.chapters.reduce((sum, chapter) => {
                            const topicSum = (chapter.topics ?? [])
                              .filter((t) => aiSelectedTopics[t.id])
                              .reduce((tSum, t) => tSum + (aiTopicAllocations[t.id] ?? 0), 0)
                            if (topicSum > 0) return sum + topicSum
                            if (aiSelectedChapters[chapter.id]) {
                              return sum + (aiChapterAllocations[chapter.id] ?? 0)
                            }
                            return sum
                          }, 0)
                          const subjectRemaining = subjectTotal - subjectAllocated

                          return (
                            <div
                              key={subject.subject_id}
                              className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
                                  {subject.subject_name}
                                </h3>
                                <span className="text-xs text-gray-500 dark:text-[#A8A8A8]">
                                  Q{subject.range_from}–Q{subject.range_to} ({subjectTotal} questions)
                                </span>
                              </div>

                              <div className="mb-3">
                                <div className="flex justify-between text-xs text-gray-500 dark:text-[#A8A8A8] mb-1">
                                  <span>Allocated: {subjectAllocated}</span>
                                  <span className={subjectRemaining < 0 ? 'text-red-500' : 'text-green-600'}>
                                    Remaining: {subjectRemaining}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
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

                              <div className="space-y-3">
                                {subject.chapters.length === 0 ? (
                                  <p className="text-xs text-gray-400 dark:text-[#A8A8A8]">No chapters for this subject.</p>
                                ) : (
                                  subject.chapters.map((chapter) => {
                                    const hasTopicAllocations = (chapter.topics ?? []).some(
                                      (t) => aiSelectedTopics[t.id] && aiTopicAllocations[t.id] > 0
                                    )

                                    return (
                                      <div
                                        key={chapter.id}
                                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <input
                                            type="checkbox"
                                            checked={!!aiSelectedChapters[chapter.id]}
                                            disabled={hasTopicAllocations}
                                            onChange={(e) => {
                                              setAiSelectedChapters((prev) => ({
                                                ...prev,
                                                [chapter.id]: e.target.checked,
                                              }))
                                              if (!e.target.checked) {
                                                setAiChapterAllocations((prev) => ({
                                                  ...prev,
                                                  [chapter.id]: 0,
                                                }))
                                              }
                                            }}
                                            className="rounded border-gray-300 dark:border-gray-600 text-purple-600 shrink-0"
                                          />
                                          <span className="flex-1 min-w-[120px] text-sm font-medium text-gray-900 dark:text-[#FFFFFF]">
                                            {chapter.name}
                                          </span>
                                          {aiSelectedChapters[chapter.id] && !hasTopicAllocations && (
                                            <input
                                              type="number"
                                              min={1}
                                              max={subjectTotal}
                                              value={aiChapterAllocations[chapter.id] ?? ''}
                                              onChange={(e) =>
                                                setAiChapterAllocations((prev) => ({
                                                  ...prev,
                                                  [chapter.id]: Number(e.target.value),
                                                }))
                                              }
                                              placeholder="Q count"
                                              className="w-20 shrink-0 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-center dark:bg-[#262626]"
                                            />
                                          )}
                                        </div>

                                        {(chapter.topics ?? []).length > 0 && (
                                          <div className="mt-2 ml-6 space-y-2 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
                                            <p className="text-xs text-gray-500 dark:text-[#A8A8A8]">Optional topics</p>
                                            {(chapter.topics ?? []).map((topic) => (
                                              <div key={topic.id} className="flex items-center gap-2 flex-wrap">
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
                                                    } else {
                                                      setAiSelectedChapters((prev) => ({
                                                        ...prev,
                                                        [chapter.id]: false,
                                                      }))
                                                      setAiChapterAllocations((prev) => ({
                                                        ...prev,
                                                        [chapter.id]: 0,
                                                      }))
                                                    }
                                                  }}
                                                  className="rounded border-gray-300 dark:border-gray-600 text-purple-600 shrink-0"
                                                />
                                                <span className="flex-1 min-w-[100px] text-sm text-gray-800 dark:text-[#FFFFFF]">
                                                  {topic.name}
                                                </span>
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
                                                    className="w-20 shrink-0 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-center dark:bg-[#262626]"
                                                  />
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {(() => {
                          const totalAllocated =
                            Object.values(aiChapterAllocations).reduce((sum, v) => sum + (v || 0), 0) +
                            Object.values(aiTopicAllocations).reduce((sum, v) => sum + (v || 0), 0)
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
                            disabled={
                              (Object.values(aiSelectedChapters).filter(Boolean).length === 0 &&
                                Object.values(aiSelectedTopics).filter(Boolean).length === 0) ||
                              (Object.values(aiChapterAllocations).reduce((s, v) => s + (v || 0), 0) +
                                Object.values(aiTopicAllocations).reduce((s, v) => s + (v || 0), 0)) !==
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
                            <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                              Exam Board
                            </label>
                            <select
                              value={aiBoard}
                              onChange={(e) => setAiBoard(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                            >
                              {['CBSE', 'ICSE', 'State Board', 'JEE', 'NEET', 'Internal Test'].map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-1">
                              Class Level
                            </label>
                            <input
                              type="text"
                              value={aiClassLevel}
                              onChange={(e) => setAiClassLevel(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#262626] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                              placeholder="e.g. Class 10"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-[#A8A8A8] mb-2">
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
                                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-[#A8A8A8]'
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
                            .filter((s) =>
                              s.chapters.some(
                                (c) =>
                                  aiSelectedChapters[c.id] ||
                                  (c.topics ?? []).some((t) => aiSelectedTopics[t.id])
                              )
                            )
                            .map((subject) => {
                              const selectedLabels = subject.chapters.flatMap((chapter) => {
                                const topicLabels = (chapter.topics ?? [])
                                  .filter((t) => aiSelectedTopics[t.id])
                                  .map((t) => `${chapter.name} → ${t.name}`)
                                if (topicLabels.length > 0) return topicLabels
                                if (aiSelectedChapters[chapter.id]) return [chapter.name]
                                return []
                              })
                              return (
                                <div key={subject.subject_id} className="text-xs text-gray-600 dark:text-[#A8A8A8]">
                                  <span className="font-medium">{subject.subject_name}:</span>{' '}
                                  {selectedLabels.join(', ')}
                                </div>
                              )
                            })}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAiStep(2)}
                            className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-[#A8A8A8] dark:bg-[#262626]"
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
                        <p className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF]">
                          {generatedQuestions.length} questions generated — review and edit:
                        </p>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {generatedQuestions.map((q, index) => (
                            <div key={index} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-purple-600 font-medium">
                                  {q.chapter_name ?? 'Chapter'}
                                  {q.topic_name && q.topic_name !== q.chapter_name ? ` → ${q.topic_name}` : ''}
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
                                className="w-full text-sm border-2 border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 mb-2 resize-none"
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
                                          : 'bg-gray-100 dark:bg-[#262626] text-gray-400 dark:text-[#A8A8A8]'
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
                                      className="flex-1 text-xs border-2 border-gray-200 dark:border-gray-700 rounded px-2 py-1"
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
                            className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-[#A8A8A8] dark:bg-[#262626]"
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
