import { supabase } from '../supabase'

export async function fetchLinkedStudent(parentUser) {
  if (!parentUser?.roll_number || !parentUser?.institute_id) return null

  const { data } = await supabase
    .from('users')
    .select('*, classes(name), institutes(name, city)')
    .eq('roll_number', parentUser.roll_number)
    .eq('role', 'student')
    .eq('institute_id', parentUser.institute_id)
    .limit(1)
    .maybeSingle()

  return data
}
