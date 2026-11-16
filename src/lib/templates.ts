import type { IntervalUnit } from './types'

export interface ActionTemplate {
  id: string
  label: string
  description: string
  intervalValue: number
  intervalUnit: IntervalUnit
  checklist: string[]
}

export const DEFAULT_TEMPLATES: ActionTemplate[] = [
  {
    id: 'vidange',
    label: 'Vidange',
    description: 'Vidange et remplacement des consommables.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: ['Huile', 'Filtre', 'Niveaux']
  },
  {
    id: 'taille',
    label: 'Taille annuelle',
    description: 'Taille d’entretien de la plante.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'assurance',
    label: 'Assurance',
    description: 'Renouvellement du contrat.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'controle-technique',
    label: 'Contrôle technique',
    description: 'Contrôle périodique du véhicule.',
    intervalValue: 2,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'poele-granules',
    label: 'Entretien poêle à granulés',
    description: 'Entretien annuel du poêle et de son conduit.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: [
      'Nettoyer le foyer et le cendrier',
      'Brosser l’échangeur de chaleur',
      'Vérifier le conduit et les joints',
      'Nettoyer le ventilateur',
      'Tester la combustion'
    ]
  },
  {
    id: 'pompe-a-chaleur',
    label: 'Entretien pompe à chaleur',
    description: 'Entretien périodique de la pompe à chaleur.',
    intervalValue: 2,
    intervalUnit: 'year',
    checklist: [
      'Nettoyer ou remplacer les filtres',
      'Contrôler le circuit frigorifique',
      'Vérifier les pressions',
      'Nettoyer l’unité extérieure',
      'Contrôler les connexions électriques'
    ]
  },
  {
    id: 'impots-bic',
    label: 'Déclaration BIC',
    description: 'Déclaration annuelle des bénéfices industriels et commerciaux.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: [
      'Rassembler les justificatifs',
      'Calculer le bénéfice',
      'Vérifier les charges déductibles',
      'Déclarer en ligne',
      'Archiver la confirmation'
    ]
  },
  {
    id: 'impots-revenu',
    label: 'Déclaration de revenus',
    description: 'Déclaration annuelle des revenus.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: [
      'Rassembler les justificatifs',
      'Vérifier les cases préremplies',
      'Déclarer les revenus et charges',
      'Payer le solde',
      'Archiver l’avis d’imposition'
    ]
  }
]

const STORAGE_KEY = 'action.templates'
const UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year']

export function defaultTemplates(): ActionTemplate[] {
  return DEFAULT_TEMPLATES.map((template) => ({
    ...template,
    checklist: [...template.checklist]
  }))
}

function normalizeTemplate(raw: unknown): ActionTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const label = typeof value.label === 'string' ? value.label.trim() : ''
  if (!label) return null
  const intervalValue = Math.max(1, Math.round(Number(value.intervalValue) || 1))
  const intervalUnit = UNITS.includes(value.intervalUnit as IntervalUnit)
    ? (value.intervalUnit as IntervalUnit)
    : 'year'
  const checklist = Array.isArray(value.checklist)
    ? value.checklist
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
  const id =
    typeof value.id === 'string' && value.id.trim() ? value.id.trim() : crypto.randomUUID()
  return {
    id,
    label,
    description: typeof value.description === 'string' ? value.description.trim() : '',
    intervalValue,
    intervalUnit,
    checklist
  }
}

export function normalizeTemplates(raw: unknown): ActionTemplate[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeTemplate)
    .filter((template): template is ActionTemplate => template !== null)
}

export function loadTemplates(): ActionTemplate[] {
  if (typeof localStorage === 'undefined') return defaultTemplates()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultTemplates()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultTemplates()
    return normalizeTemplates(parsed)
  } catch {
    return defaultTemplates()
  }
}

export function saveTemplates(templates: ActionTemplate[]): void {
  if (typeof localStorage === 'undefined') return
  const clean = normalizeTemplates(templates)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
}

export function resetTemplates(): ActionTemplate[] {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  return defaultTemplates()
}
