import type { IntervalUnit } from './types'

export interface ActionTemplate {
  id: string
  label: string
  description: string
  intervalValue: number
  intervalUnit: IntervalUnit
  checklist: string[]
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
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
  }
]
