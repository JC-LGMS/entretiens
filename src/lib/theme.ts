import { get, writable } from 'svelte/store'

export type Theme = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const KEY = 'theme'

export function getTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const initial = getTheme()

export const themeState = writable<{ mode: Theme; resolved: ResolvedTheme }>({
  mode: initial,
  resolved: resolveTheme(initial)
})

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme

  const resolved = resolveTheme(theme)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#121714' : '#f3f6f2')
  themeState.set({ mode: theme, resolved })
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Le thème reste appliqué pour la session si le stockage est bloqué.
  }
  applyTheme(theme)
}

export function toggleTheme(): void {
  setTheme(resolveTheme(getTheme()) === 'dark' ? 'light' : 'dark')
}

export function initTheme(): void {
  applyTheme(getTheme())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system')
  })
}
