import { describe, expect, it } from 'vitest'
import { cleanProfileName, normalizeProfileName } from './profile-name'

describe('noms de profils', () => {
  it('nettoie les espaces', () => {
    expect(cleanProfileName('  Jean   Cyrille ')).toBe('Jean Cyrille')
  })

  it('compare sans tenir compte de la casse', () => {
    expect(normalizeProfileName(' Julie ')).toBe(normalizeProfileName('julie'))
    expect(normalizeProfileName('JULIE')).toBe('julie')
  })
})
