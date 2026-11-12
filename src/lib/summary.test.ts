import { describe, expect, it } from 'vitest'
import { describeChange, joinSummary } from './summary'

describe('résumé de modification', () => {
  it('décrit un changement', () => {
    expect(describeChange('Nom', 'Tondeuse', 'Tondeuse robot')).toBe('Nom : Tondeuse → Tondeuse robot')
    expect(describeChange('Nom', 'Tondeuse', 'Tondeuse')).toBeNull()
    expect(describeChange('Notes', '', 'Abri')).toBe('Notes : Abri')
    expect(describeChange('Nom', 'Tondeuse', '')).toBe('Nom supprimé')
  })

  it('assemble plusieurs changements', () => {
    expect(joinSummary(['A', null, 'B'])).toBe('A · B')
    expect(joinSummary([null, ''])).toBe('')
  })
})
