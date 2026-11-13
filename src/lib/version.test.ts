import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG, formatVersion } from './version'

describe('version', () => {
  it('affiche la version la plus récente', () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version)
  })

  it('garde uniquement le format 0.x', () => {
    expect(formatVersion('0.4.0')).toBe('0.4')
    expect(formatVersion('0.10.0')).toBe('0.10')
    expect(APP_VERSION).not.toMatch(/\.0$/)
  })

  it('ne contient que des versions uniques', () => {
    const versions = CHANGELOG.map((entry) => entry.version)
    expect(new Set(versions).size).toBe(versions.length)
  })
})
