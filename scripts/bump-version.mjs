import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = 'package.json'
const changelogPath = 'src/lib/changelog.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [major, minor] = String(pkg.version).split('.').map(Number)
const version = minor >= 9 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
const date = new Date().toISOString().slice(0, 10)
const message = process.argv.slice(2).join(' ') || "Mise à jour de l'application"

pkg.version = version
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

const changelog = JSON.parse(readFileSync(changelogPath, 'utf8'))
if (changelog[0]?.version === version) {
  changelog[0].changes.push(message)
} else {
  changelog.unshift({ version, date, changes: [message] })
}
writeFileSync(changelogPath, `${JSON.stringify(changelog, null, 2)}\n`)

console.log(`Version ${version}`)
