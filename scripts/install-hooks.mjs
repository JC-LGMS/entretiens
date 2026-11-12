import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs'

if (!existsSync('.git')) process.exit(0)
const hooksDir = '.git/hooks'
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true })

const hook = `#!/bin/sh
case "$2" in
  merge|squash|commit) exit 0 ;;
esac
if git diff --cached --name-only | grep -qE '^src/'; then
  msg=$(head -n 1 "$1")
  node scripts/bump-version.mjs "$msg" >/dev/null 2>&1 || exit 0
  git add package.json src/lib/changelog.json
fi
`

const target = `${hooksDir}/prepare-commit-msg`
writeFileSync(target, hook)
try {
  chmodSync(target, 0o755)
} catch {
  // Windows : Git exécute le hook via sh, le bit exécutable n'est pas requis.
}
