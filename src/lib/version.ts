import entries from './changelog.json'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export function formatVersion(version: string): string {
  return version.replace(/\.0$/, '')
}

export const CHANGELOG = (entries as ChangelogEntry[]).map((entry) => ({
  ...entry,
  version: formatVersion(entry.version)
}))

const rawVersion =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__
    ? __APP_VERSION__
    : (CHANGELOG[0]?.version ?? '0.0')

export const APP_VERSION = formatVersion(rawVersion)
