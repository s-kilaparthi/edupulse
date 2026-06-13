import { supabase } from '../supabase'

export const WEEK_DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const DEFAULT_WEEKLY_OFF = ['Sunday']

export const DAY_KEY_TO_NAME = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return ''
  const normalized = dateStr.slice(0, 10)
  const [y, m, d] = normalized.split('-')
  return `${d}/${m}/${y}`
}

export function normalizeWeeklyOff(value) {
  if (!Array.isArray(value) || value.length === 0) return [...DEFAULT_WEEKLY_OFF]
  return value
}

export function getDayNameFromDate(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date(`${dateStr.slice(0, 10)}T00:00:00`).getDay()]
}

export function getWeekDatesForGrid(referenceDate = new Date()) {
  const d = new Date(referenceDate)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(d.getDate() + mondayOffset)

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const mapping = {}
  for (let i = 0; i < dayOrder.length; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    mapping[dayOrder[i]] = date.toISOString().split('T')[0]
  }
  return mapping
}

export function getHolidayForDate(dateStr, holidays) {
  const target = dateStr?.slice(0, 10)
  return (holidays ?? []).find((h) => h.date?.slice(0, 10) === target) ?? null
}

export function isWeeklyOffDay(dayName, weeklyOff) {
  return normalizeWeeklyOff(weeklyOff).includes(dayName)
}

export function getDayOffInfo(dayKey, weekDates, holidays, weeklyOff) {
  const dateStr = weekDates[dayKey]
  const dayName = DAY_KEY_TO_NAME[dayKey]
  const holiday = dateStr ? getHolidayForDate(dateStr, holidays) : null

  if (holiday) {
    return { type: 'holiday', name: holiday.name, date: dateStr }
  }
  if (isWeeklyOffDay(dayName, weeklyOff)) {
    return { type: 'weekly_off', name: 'Weekly Holiday', date: dateStr }
  }
  return null
}

export function checkDateHolidayStatus(dateStr, holidays, weeklyOff) {
  const holiday = getHolidayForDate(dateStr, holidays)
  if (holiday) {
    return { isOff: true, type: 'holiday', name: holiday.name }
  }
  const dayName = getDayNameFromDate(dateStr)
  if (isWeeklyOffDay(dayName, weeklyOff)) {
    return { isOff: true, type: 'weekly_off', name: 'Weekly Holiday' }
  }
  return { isOff: false, type: null, name: null }
}

export async function fetchHolidayData(instituteId) {
  if (!instituteId) {
    return { weeklyOff: [...DEFAULT_WEEKLY_OFF], holidays: [] }
  }

  const [settingsRes, holidaysRes] = await Promise.all([
    supabase
      .from('schedule_settings')
      .select('weekly_off')
      .eq('institute_id', instituteId)
      .maybeSingle(),
    supabase
      .from('holidays')
      .select('id, date, name')
      .eq('institute_id', instituteId)
      .order('date'),
  ])

  return {
    weeklyOff: normalizeWeeklyOff(settingsRes.data?.weekly_off),
    holidays: holidaysRes.data ?? [],
  }
}
