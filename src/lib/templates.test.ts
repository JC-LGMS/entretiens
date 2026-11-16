import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, defaultTemplates, normalizeTemplates } from './templates'

describe('modèles d’actions', () => {
  it('retourne une copie des modèles par défaut', () => {
    const first = defaultTemplates()
    const second = defaultTemplates()
    expect(first.length).toBeGreaterThan(0)
    expect(first).not.toBe(second)
    first[0].checklist.push('modifié')
    expect(second[0].checklist).not.toContain('modifié')
  })

  it('utilise des identifiants stables et uniques', () => {
    const ids = DEFAULT_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    }
    expect(defaultTemplates().map((template) => template.id)).toEqual(ids)
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
})
