export function describeChange(label: string, before: unknown, after: unknown): string | null {
  const a = before ?? ''
  const b = after ?? ''
  if (String(a) === String(b)) return null
  if (String(a) === '') return `${label} : ${String(b)}`
  if (String(b) === '') return `${label} supprimé`
  return `${label} : ${String(a)} → ${String(b)}`
}

export function joinSummary(parts: (string | null)[]): string {
  return parts.filter((p): p is string => !!p).join(' · ')
}
