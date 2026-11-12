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

export function annualDateLabel(md: string): string {
  const [month, day] = md.split('-').map(Number)
  return format(new Date(2000, month - 1, day), 'd MMM', { locale: fr })
}

export function annualDatesLabel(dates: string[]): string {
  return dates.map(annualDateLabel).join(', ')
}

export function nextAnnualDue(dates: string[], fromISO: string, inclusive: boolean): string {
  const cleaned = [...new Set(dates.filter((md) => /^\d{2}-\d{2}$/.test(md)))]
  if (cleaned.length === 0) return fromISO

  const from = parseISO(fromISO)
  const startYear = from.getFullYear()
  const candidates: Date[] = []

  for (let year = startYear; year <= startYear + 2; year++) {
    for (const md of cleaned) {
      const [month, day] = md.split('-').map(Number)
      let candidate = new Date(year, month - 1, day)
      if (candidate.getMonth() !== month - 1) {
        candidate = new Date(year, month, 0)
      }
      candidates.push(candidate)
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime())
  const next = candidates.find((candidate) => (inclusive ? candidate >= from : candidate > from))
  return format(next ?? candidates[candidates.length - 1], 'yyyy-MM-dd')
}
