export function cleanProfileName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeProfileName(name: string): string {
  return cleanProfileName(name).toLocaleLowerCase('fr')
}
