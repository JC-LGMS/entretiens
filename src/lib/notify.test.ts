import { describe, expect, it } from 'vitest'
import { addInterval, todayISO } from './dates'
import { urgencyOf } from './urgency'
import { shouldShowNotification } from './notify'

function relative(days: number): string {
  return addInterval(todayISO(), days, 'day')
}

describe('urgence', () => {
  it('classe les échéances', () => {
    expect(urgencyOf(relative(-1))).toBe('overdue')
    expect(urgencyOf(relative(0))).toBe('today')
    expect(urgencyOf(relative(7))).toBe('soon')
    expect(urgencyOf(relative(8))).toBe('later')
  })
})

describe('filtre de notification', () => {
  it('exige un profil et l’absence de silence', () => {
    expect(shouldShowNotification(null, false)).toBe(false)
    expect(shouldShowNotification('', false)).toBe(false)
    expect(shouldShowNotification('profil', true)).toBe(false)
    expect(shouldShowNotification('profil', false)).toBe(true)
  })
})
