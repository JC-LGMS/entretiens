import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs'

if (!existsSync('.git')) process.exit(0)
const hooksDir = '.git/hooks'
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true })

// Remplace l'ancien hook prepare-commit-msg, qui stagedait après le snapshot du commit.
const oldHook = `${hooksDir}/prepare-commit-msg`
if (existsSync(oldHook) && readFileSync(oldHook, 'utf8').includes('bump-version.mjs')) {
  rmSync(oldHook, { force: true })
}

const hook = `#!/bin/sh
# entretiens version hook
if git diff --cached --name-only | grep -qE '^(package.json|src/lib/changelog.json)$'; then
  exit 0
fi
if git diff --cached --name-only | grep -qE '^src/'; then
  node scripts/bump-version.mjs "\${VERSION_MESSAGE:-Mise à jour de l'application}" >/dev/null 2>&1 || exit 0
  git add package.json src/lib/changelog.json
fi
`

const target = `${hooksDir}/pre-commit`
writeFileSync(target, hook)
try {
  chmodSync(target, 0o755)
} catch {
  // Windows : Git exécute le hook via sh, le bit exécutable n'est pas requis.
}
