import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { IntervalUnit } from './types'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime())
}

export function addInterval(dateISO: string, value: number, unit: IntervalUnit): string {
  const date = parseISO(dateISO)
  const next =
    unit === 'day'
      ? addDays(date, value)
      : unit === 'week'
        ? addWeeks(date, value)
        : unit === 'month'
          ? addMonths(date, value)
          : addYears(date, value)
  return format(next, 'yyyy-MM-dd')
}

export function daysUntil(dateISO: string): number {
  return differenceInCalendarDays(parseISO(dateISO), new Date())
}

export function formatDate(dateISO: string): string {
  return format(parseISO(dateISO), 'dd MMM yyyy', { locale: fr })
}

export function formatShort(dateISO: string): string {
  return format(parseISO(dateISO), 'dd/MM/yyyy')
}

export function intervalLabel(value: number, unit: IntervalUnit): string {
  if (value === 1) {
    const singles: Record<IntervalUnit, string> = {
      day: 'tous les jours',
      week: 'toutes les semaines',
      month: 'tous les mois',
      year: 'tous les ans'
    }
    return singles[unit]
  }
  const labels: Record<IntervalUnit, [string, string]> = {
    day: ['jour', 'jours'],
    week: ['semaine', 'semaines'],
    month: ['mois', 'mois'],
    year: ['an', 'ans']
  }
  const [one, many] = labels[unit]
  const word = value === 1 ? one : many
  const prefix = unit === 'week' ? 'toutes les' : 'tous les'
  return `${prefix} ${value} ${word}`
}
