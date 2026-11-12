export type Theme = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function getTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme

  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#121714' : '#f3f6f2')
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Le thème reste appliqué pour la session si le stockage est bloqué.
  }
  applyTheme(theme)
}

export function initTheme(): void {
  applyTheme(getTheme())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system')
  })
}
