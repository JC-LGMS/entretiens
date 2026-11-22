import type { ActionRow, LogRow, ProfileRow } from './types'

export interface ActivityStats {
  overdue: number
  month: number
  byProfile: [string, number][]
}

export function activityStats(
  actions: ActionRow[],
  logs: LogRow[],
  profiles: ProfileRow[],
  today: string
): ActivityStats {
  const month = today.slice(0, 7)
  const monthLogs = logs.filter((log) => !log.deleted_at && log.done_on.startsWith(month))
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]))
  const counts = new Map<string, number>()
  for (const log of monthLogs) {
    const name = log.created_by ? names.get(log.created_by) ?? 'Profil supprimé' : 'Sans profil'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return {
    overdue: actions.filter(
      (action) => !action.deleted_at && action.active && !action.archived && action.next_due < today
    ).length,
    month: monthLogs.length,
    byProfile: [...counts].sort((a, b) => b[1] - a[1])
  }
}
