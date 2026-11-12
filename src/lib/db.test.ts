import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db, queueOutbox } from './db'

describe('file de synchronisation', () => {
  beforeEach(async () => {
    await db.outbox.clear()
  })

  afterAll(() => {
    db.close()
  })

  it('fusionne les modifications successives d’une même ligne', async () => {
    await queueOutbox('entities', 'entite-1', { id: 'entite-1', name: 'Ancien nom' })
    await queueOutbox('entities', 'entite-1', { id: 'entite-1', name: 'Nouveau nom' })

    const rows = await db.outbox.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].payload.name).toBe('Nouveau nom')
  })

  it('garde des lignes distinctes et un ordre stable', async () => {
    await queueOutbox('profiles', 'profil-1', { id: 'profil-1', name: 'Julie' })
    await queueOutbox('entities', 'entite-1', { id: 'entite-1', name: 'Tondeuse' })

    const rows = await db.outbox.orderBy('seq').toArray()
    expect(rows).toHaveLength(2)
    expect(rows[0].table).toBe('profiles')
    expect(rows[1].table).toBe('entities')
  })
})
