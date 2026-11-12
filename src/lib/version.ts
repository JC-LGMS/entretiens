import entries from './changelog.json'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG = entries as ChangelogEntry[]

export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__
    ? __APP_VERSION__
    : (CHANGELOG[0]?.version ?? '0.0.0')
