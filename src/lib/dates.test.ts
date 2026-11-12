import { describe, expect, it } from 'vitest'
import { addInterval, intervalLabel, nextAnnualDue } from './dates'

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

describe('nextAnnualDue', () => {
  const dates = ['03-01', '10-15']

  it('choisit la prochaine date fixe', () => {
    expect(nextAnnualDue(dates, '2026-02-01', true)).toBe('2026-03-01')
    expect(nextAnnualDue(dates, '2026-06-01', true)).toBe('2026-10-15')
  })

  it('passe à l’année suivante après la dernière date', () => {
    expect(nextAnnualDue(dates, '2026-10-16', false)).toBe('2027-03-01')
  })

  it('saute la date du jour quand elle vient d’être faite', () => {
    expect(nextAnnualDue(dates, '2026-03-01', false)).toBe('2026-10-15')
  })

  it('gère le 29 février hors année bissextile', () => {
    expect(nextAnnualDue(['02-29'], '2026-01-01', true)).toBe('2026-02-28')
    expect(nextAnnualDue(['02-29'], '2028-02-01', true)).toBe('2028-02-29')
  })
})
