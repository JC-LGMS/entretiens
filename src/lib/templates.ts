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
