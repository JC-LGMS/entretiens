import { describe, expect, it } from 'vitest'
import { activityStats } from './stats'
import type { ActionRow, LogRow, ProfileRow } from './types'

const actions = [
  { id: 'a1', active: true, archived: false, deleted_at: null, next_due: '2026-11-01' },
  { id: 'a2', active: false, archived: false, deleted_at: null, next_due: '2026-11-01' },
  { id: 'a3', active: true, archived: true, deleted_at: null, next_due: '2026-11-01' },
  { id: 'a4', active: true, archived: false, deleted_at: null, next_due: '2026-11-30' }
] as ActionRow[]

const logs = [
  { done_on: '2026-11-02', created_by: 'p1', deleted_at: null },
  { done_on: '2026-11-03', created_by: 'p1', deleted_at: null },
  { done_on: '2026-11-04', created_by: null, deleted_at: null },
  { done_on: '2026-11-05', created_by: 'p1', deleted_at: '2026-11-06' },
  { done_on: '2026-10-30', created_by: 'p1', deleted_at: null }
] as LogRow[]

const profiles = [{ id: 'p1', name: 'JC' }] as ProfileRow[]

describe('activité', () => {
  it('compte les retards, le mois et la répartition par profil', () => {
    const stats = activityStats(actions, logs, profiles, '2026-11-22')
    expect(stats.overdue).toBe(1)
    expect(stats.month).toBe(3)
    expect(stats.byProfile).toEqual([
      ['JC', 2],
      ['Sans profil', 1]
    ])
  })
})
