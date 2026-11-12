import { describe, expect, it } from 'vitest'
import { addInterval, intervalLabel } from './dates'

describe('addInterval', () => {
  it('gère les fins de mois', () => {
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28')
    expect(addInterval('2026-01-31', 1, 'year')).toBe('2027-01-31')
  })

  it('gère les années bissextiles', () => {
    expect(addInterval('2024-02-29', 1, 'year')).toBe('2025-02-28')
    expect(addInterval('2024-02-29', 1, 'month')).toBe('2024-03-29')
  })

  it('ajoute jours, semaines et années', () => {
    expect(addInterval('2026-11-12', 3, 'day')).toBe('2026-11-15')
    expect(addInterval('2026-11-12', 2, 'week')).toBe('2026-11-26')
    expect(addInterval('2026-11-12', 2, 'year')).toBe('2028-11-12')
  })
})

describe('intervalLabel', () => {
  it('accorde les libellés', () => {
    expect(intervalLabel(1, 'day')).toBe('tous les jours')
    expect(intervalLabel(3, 'day')).toBe('tous les 3 jours')
    expect(intervalLabel(1, 'month')).toBe('tous les mois')
    expect(intervalLabel(1, 'week')).toBe('toutes les semaines')
    expect(intervalLabel(2, 'year')).toBe('tous les 2 ans')
  })
})
