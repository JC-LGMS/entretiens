import { daysUntil } from './dates'

export type Urgency = 'overdue' | 'today' | 'soon' | 'later'

export function urgencyOf(nextDue: string): Urgency {
  const days = daysUntil(nextDue)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 7) return 'soon'
  return 'later'
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: 'En retard',
  today: "Aujourd'hui",
  soon: 'Bientôt',
  later: 'Plus tard'
}

export function dueLabel(nextDue: string): string {
  const days = daysUntil(nextDue)
  if (days < 0) return `${-days} j de retard`
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  return `Dans ${days} j`
}
