import { db, saveLocal, softDelete } from './db'
import {
  LEGACY_STORAGE_KEY,
  LEGACY_TEMPLATE_IDS,
  defaultTemplates,
  normalizeTemplates,
  type ActionTemplate
} from './templates'
import type { ActionTemplateRow } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let legacyMigration: Promise<void> | null = null

function sharedId(id: string): string {
  const legacy = LEGACY_TEMPLATE_IDS[id]
  if (legacy) return legacy
  return UUID_RE.test(id) ? id.toLowerCase() : crypto.randomUUID()
}

function rowToTemplate(row: ActionTemplateRow): ActionTemplate {
  return {
    id: row.id,
    label: row.label,
    description: row.description ?? '',
    intervalValue: Math.max(1, Math.round(Number(row.interval_value) || 1)),
    intervalUnit: row.interval_unit,
    checklist: Array.isArray(row.checklist) ? [...row.checklist] : []
  }
}

function toRow(
  template: ActionTemplate,
  sortOrder: number,
  updatedAt: string,
  deletedAt: string | null
): ActionTemplateRow {
  return {
    id: template.id,
    label: template.label,
    description: template.description,
    interval_value: template.intervalValue,
    interval_unit: template.intervalUnit,
    checklist: [...template.checklist],
    sort_order: sortOrder,
    updated_at: updatedAt,
    deleted_at: deletedAt
  }
}

function sameRow(row: ActionTemplateRow, next: ActionTemplateRow): boolean {
  return (
    row.label === next.label &&
    row.description === next.description &&
    row.interval_value === next.interval_value &&
    row.interval_unit === next.interval_unit &&
    row.sort_order === next.sort_order &&
    JSON.stringify(row.checklist) === JSON.stringify(next.checklist)
  )
}

function sameAsDefaults(templates: ActionTemplate[]): boolean {
  const defaults = defaultTemplates()
  if (templates.length !== defaults.length) return false
  return templates.every((template, index) => {
    const other = defaults[index]
    return (
      template.id === other.id &&
      template.label === other.label &&
      template.description === other.description &&
      template.intervalValue === other.intervalValue &&
      template.intervalUnit === other.intervalUnit &&
      JSON.stringify(template.checklist) === JSON.stringify(other.checklist)
    )
  })
}

/**
 * Reprend une seule fois les modèles enregistrés en local par la version 0.9
 * et les pousse dans la table partagée.
 */
async function migrateLegacyTemplates(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return
  }

  const templates = normalizeTemplates(parsed)
  if (!templates.length) {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return
  }

  const existing = await db.actionTemplates.count()
  if (existing > 0) {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return
  }

  const now = new Date().toISOString()
  for (const [index, template] of templates.entries()) {
    const row = toRow({ ...template, id: sharedId(template.id) }, (index + 1) * 10, now, null)
    await saveLocal('action_templates', row)
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

async function ensureLegacyMigrated(): Promise<void> {
  if (legacyMigration) {
    await legacyMigration
    return
  }
  legacyMigration = migrateLegacyTemplates().finally(() => {
    legacyMigration = null
  })
  await legacyMigration
}

export async function loadActionTemplates(): Promise<ActionTemplate[]> {
  await ensureLegacyMigrated()

  const rows = await db.actionTemplates.toArray()
  const live = rows.filter((row) => !row.deleted_at)
  if (!live.length) {
    // Avant le premier pull, on propose les modèles par défaut.
    return rows.length ? [] : defaultTemplates()
  }
  return live
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'fr'))
    .map(rowToTemplate)
}

export async function saveActionTemplates(templates: ActionTemplate[]): Promise<void> {
  await ensureLegacyMigrated()

  const clean = normalizeTemplates(templates)
  const existingRows = await db.actionTemplates.toArray()
  const existing = new Map(existingRows.map((row) => [row.id, row]))
  const kept = new Set<string>()
  const now = new Date().toISOString()

  // Rien à pousser : les modèles affichés sont déjà ceux de la migration SQL.
  if (!existingRows.length && sameAsDefaults(clean)) return

  for (const [index, template] of clean.entries()) {
    const id = sharedId(template.id)
    if (kept.has(id)) continue
    kept.add(id)
    const row = toRow({ ...template, id }, (index + 1) * 10, now, null)
    const previous = existing.get(id)
    if (previous && !previous.deleted_at && sameRow(previous, row)) continue
    await saveLocal('action_templates', row)
  }

  for (const row of existingRows) {
    if (!kept.has(row.id) && !row.deleted_at) await softDelete('action_templates', row.id)
  }
}
