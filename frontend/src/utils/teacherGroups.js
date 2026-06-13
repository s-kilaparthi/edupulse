import { supabase } from '../supabase'

export function extractGroupClasses(group) {
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

export function filterClassesByGroup(allClasses, groupId, classGroups) {
  if (!groupId) return allClasses
  const group = classGroups.find((g) => g.id === groupId)
  const groupClassIds = new Set(extractGroupClasses(group).map((c) => c.id))
  return allClasses.filter((c) => groupClassIds.has(c.id))
}

export async function fetchTeacherClassesAndGroups(teacherId, instituteId) {
  const { data: assignments } = await supabase
    .from('class_teachers')
    .select('class_id, classes(id, name)')
    .eq('teacher_id', teacherId)

  const classes = []
  const seen = new Set()
  const teacherClassIds = []

  for (const row of assignments ?? []) {
    if (row.classes && !seen.has(row.class_id)) {
      seen.add(row.class_id)
      classes.push(row.classes)
      teacherClassIds.push(row.class_id)
    }
  }
  classes.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  if (!teacherClassIds.length || !instituteId) {
    return { classes, groups: [] }
  }

  const { data: members } = await supabase
    .from('class_group_members')
    .select('group_id')
    .in('class_id', teacherClassIds)

  const groupIds = [...new Set((members ?? []).map((m) => m.group_id))]
  if (!groupIds.length) {
    return { classes, groups: [] }
  }

  const { data: groups } = await supabase
    .from('class_groups')
    .select('id, name, class_group_members(class_id, classes(id, name))')
    .eq('institute_id', instituteId)
    .in('id', groupIds)
    .order('name')

  return { classes, groups: groups ?? [] }
}
