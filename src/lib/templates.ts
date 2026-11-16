import type { IntervalUnit } from './types'

export interface ActionTemplate {
  id: string
  label: string
  description: string
  intervalValue: number
  intervalUnit: IntervalUnit
  checklist: string[]
}

// Les identifiants des modèles par défaut sont stables : la migration SQL insère
// les mêmes lignes, ce qui évite les doublons avant le premier pull.
export const DEFAULT_TEMPLATES: ActionTemplate[] = [
  {
    id: 'a1b2c3d4-0001-4a2b-8c3d-000000000001',
    label: 'Vidange',
    description: 'Vidange et remplacement des consommables.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: ['Huile', 'Filtre', 'Niveaux']
  },
  {
    id: 'a1b2c3d4-0002-4a2b-8c3d-000000000002',
    label: 'Taille annuelle',
    description: 'Taille d’entretien de la plante.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'a1b2c3d4-0003-4a2b-8c3d-000000000003',
    label: 'Assurance',
    description: 'Renouvellement du contrat.',
    intervalValue: 1,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'a1b2c3d4-0004-4a2b-8c3d-000000000004',
    label: 'Contrôle technique',
    description: 'Contrôle périodique du véhicule.',
    intervalValue: 2,
    intervalUnit: 'year',
    checklist: []
  },
  {
    id: 'a1b2c3d4-0005-4a2b-8c3d-000000000005',
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
    id: 'a1b2c3d4-0006-4a2b-8c3d-000000000006',
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
    id: 'a1b2c3d4-0007-4a2b-8c3d-000000000007',
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
    id: 'a1b2c3d4-0008-4a2b-8c3d-000000000008',
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

// Anciens identifiants (0.9 et avant) enregistrés dans localStorage.
export const LEGACY_TEMPLATE_IDS: Record<string, string> = {
  vidange: DEFAULT_TEMPLATES[0].id,
  taille: DEFAULT_TEMPLATES[1].id,
  assurance: DEFAULT_TEMPLATES[2].id,
  'controle-technique': DEFAULT_TEMPLATES[3].id,
  'poele-granules': DEFAULT_TEMPLATES[4].id,
  'pompe-a-chaleur': DEFAULT_TEMPLATES[5].id,
  'impots-bic': DEFAULT_TEMPLATES[6].id,
  'impots-revenu': DEFAULT_TEMPLATES[7].id
}

export const LEGACY_STORAGE_KEY = 'action.templates'

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
