import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultTemplates,
  loadTemplates,
  normalizeTemplates,
  saveTemplates
} from './templates'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  }
}

describe('modèles d’actions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne une copie des modèles par défaut', () => {
    const first = defaultTemplates()
    const second = defaultTemplates()
    expect(first.length).toBeGreaterThan(0)
    expect(first).not.toBe(second)
    first[0].checklist.push('modifié')
    expect(second[0].checklist).not.toContain('modifié')
  })

  it('nettoie les modèles importés', () => {
    const templates = normalizeTemplates([
      {
        id: ' test ',
        label: '  Modèle  ',
        description: '  Description  ',
        intervalValue: 0,
        intervalUnit: 'semaine',
        checklist: ['  Filtre  ', '', 3, 'Huile']
      },
      { label: '' }
    ])
    expect(templates).toHaveLength(1)
    expect(templates[0].id).toBe('test')
    expect(templates[0].label).toBe('Modèle')
    expect(templates[0].description).toBe('Description')
    expect(templates[0].intervalValue).toBe(1)
    expect(templates[0].intervalUnit).toBe('year')
    expect(templates[0].checklist).toEqual(['Filtre', 'Huile'])
  })

  it('ignore une valeur qui n’est pas un tableau', () => {
    expect(normalizeTemplates(null)).toEqual([])
    expect(normalizeTemplates({ label: 'Modèle' })).toEqual([])
  })

  it('enregistre et recharge les modèles, y compris une liste vide', () => {
    saveTemplates(defaultTemplates().slice(0, 2))
    expect(loadTemplates()).toHaveLength(2)

    saveTemplates([])
    expect(loadTemplates()).toEqual([])
  })
})
