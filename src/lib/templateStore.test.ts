import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { DEFAULT_TEMPLATES, LEGACY_STORAGE_KEY, type ActionTemplate } from './templates'
import { loadActionTemplates, saveActionTemplates } from './templateStore'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  }
}

function template(id: string, label: string): ActionTemplate {
  return {
    id,
    label,
    description: '',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: []
  }
}

const CUSTOM_ID = 'c3f0f9a2-1111-4f6c-9a5e-0d3c2b1a0001'

describe('modèles d’actions partagés', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', memoryStorage())
    await db.actionTemplates.clear()
    await db.outbox.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    db.close()
  })

  it('propose les modèles par défaut avant le premier pull', async () => {
    const templates = await loadActionTemplates()
    expect(templates.map((item) => item.label)).toEqual(
      DEFAULT_TEMPLATES.map((item) => item.label)
    )
    expect(await db.actionTemplates.count()).toBe(0)
  })

  it('reprend une seule fois les modèles de l’ancien stockage local', async () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        { ...template('vidange', 'Vidange maison'), checklist: ['Huile'] },
        template(CUSTOM_ID, 'Sur mesure')
      ])
    )

    const templates = await loadActionTemplates()
    expect(templates.map((item) => item.id)).toEqual([DEFAULT_TEMPLATES[0].id, CUSTOM_ID])
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()

    const rows = await db.actionTemplates.toArray()
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe('Vidange maison')

    // Le second chargement ne rejoue pas la migration.
    await db.actionTemplates.clear()
    await loadActionTemplates()
    expect(await db.actionTemplates.count()).toBe(0)
  })

  it('enregistre les modèles et les met dans la file de synchronisation', async () => {
    await saveActionTemplates([template(CUSTOM_ID, 'Premier'), template('autre', 'Deuxième')])

    const stored = await loadActionTemplates()
    expect(stored.map((item) => item.label)).toEqual(['Premier', 'Deuxième'])
    expect(stored.every((item) => /^[0-9a-f-]{36}$/.test(item.id))).toBe(true)

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(2)
    expect(outbox.every((row) => row.table === 'action_templates')).toBe(true)
  })

  it('supprime logiquement les modèles retirés', async () => {
    await saveActionTemplates([template(CUSTOM_ID, 'Premier'), template('autre', 'Deuxième')])
    await db.outbox.clear()

    await saveActionTemplates([template(CUSTOM_ID, 'Premier')])

    const rows = await db.actionTemplates.toArray()
    expect(rows).toHaveLength(2)
    const removed = rows.find((row) => row.id !== CUSTOM_ID)
    expect(removed?.deleted_at).toBeTruthy()
    expect(await loadActionTemplates()).toHaveLength(1)
  })

  it('ne pousse rien quand la liste par défaut est enregistrée telle quelle', async () => {
    await saveActionTemplates(DEFAULT_TEMPLATES)
    expect(await db.actionTemplates.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})
