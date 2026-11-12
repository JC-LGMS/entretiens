export type Route =
  | { name: 'planning' }
  | { name: 'entities' }
  | { name: 'settings' }
  | { name: 'entity'; id: string }
  | { name: 'profiles' }
  | { name: 'profile'; id: string }

function parse(): Route {
  const hash = location.hash.replace(/^#\/?/, '')
  if (hash === '') return { name: 'planning' }
  if (hash.startsWith('entity/')) return { name: 'entity', id: hash.slice('entity/'.length) }
  if (hash.startsWith('profile/')) return { name: 'profile', id: hash.slice('profile/'.length) }
  if (hash === 'profiles') return { name: 'profiles' }
  if (hash === 'entities') return { name: 'entities' }
  if (hash === 'settings') return { name: 'settings' }
  return { name: 'planning' }
}

export const route = $state({ current: parse() })

export function navigate(path: string): void {
  location.hash = path
}

window.addEventListener('hashchange', () => {
  route.current = parse()
})
