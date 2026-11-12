export type Route =
  | { name: 'entities' }
  | { name: 'planning' }
  | { name: 'settings' }
  | { name: 'entity'; id: string }

function parse(): Route {
  const hash = location.hash.replace(/^#\/?/, '')
  if (hash.startsWith('entity/')) return { name: 'entity', id: hash.slice('entity/'.length) }
  if (hash === 'planning') return { name: 'planning' }
  if (hash === 'settings') return { name: 'settings' }
  return { name: 'entities' }
}

export const route = $state({ current: parse() })

export function navigate(path: string): void {
  location.hash = path
}

window.addEventListener('hashchange', () => {
  route.current = parse()
})
