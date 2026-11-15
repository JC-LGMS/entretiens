import { db, saveLocal, softDelete } from './db'
import { addInterval, nextAnnualDue, todayISO } from './dates'
import type { ActionRow, LogRow } from './types'

export async function recalculateAction(actionId: string): Promise<void> {
  const action = await db.actions.get(actionId)
  if (!action) return
  const logs = (await db.logs.where('action_id').equals(actionId).toArray())
    .filter((log) => !log.deleted_at)
    .sort((a, b) => b.done_on.localeCompare(a.done_on))
  const latest = logs[0]
  const last_done = latest?.done_on ?? null
  const next_due = last_done
    ? action.annual_dates?.length
      ? nextAnnualDue(action.annual_dates, last_done, false)
      : addInterval(last_done, action.interval_value, action.interval_unit)
    : action.annual_dates?.length
      ? nextAnnualDue(action.annual_dates, todayISO(), true)
      : todayISO()
  await saveLocal('actions', {
    ...action,
    last_done,
    next_due,
    last_notified_on: null,
    notified_for: null,
    updated_at: new Date().toISOString()
  })
}

export async function deleteLog(log: LogRow): Promise<void> {
  await softDelete('logs', log.id)
  await recalculateAction(log.action_id)
}

export async function undoLastLog(actionId: string): Promise<LogRow | null> {
  const logs = await db.logs.where('action_id').equals(actionId).toArray()
  const latest = logs
    .filter((log) => !log.deleted_at)
    .sort((a, b) => b.done_on.localeCompare(a.done_on))[0]
  if (!latest) return null
  await deleteLog(latest)
  return latest
}

export function actionNextDueAfterLog(action: ActionRow, doneOn: string): string {
  return action.annual_dates?.length
    ? nextAnnualDue(action.annual_dates, doneOn, false)
    : addInterval(doneOn, action.interval_value, action.interval_unit)
}
