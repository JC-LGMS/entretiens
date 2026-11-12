import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG } from './version'

describe('version', () => {
  it('affiche la version la plus récente', () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version)
  })

  it('ne contient que des versions uniques', () => {
    const versions = CHANGELOG.map((entry) => entry.version)
    expect(new Set(versions).size).toBe(versions.length)
  })
})
