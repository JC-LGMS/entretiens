import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const dest = process.env.PHOTOS_DEST ?? 'backup'
const buckets = (process.env.PHOTOS_BUCKETS ?? 'photos,attachments')
  .split(',')
  .map((bucket) => bucket.trim())
  .filter(Boolean)

if (!url || !key) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function listBucket(bucket) {
  const files = []

  async function walk(prefix) {
    let offset = 0
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset
      })
      if (error) throw new Error(`Liste ${bucket} : ${error.message}`)
      if (!data || data.length === 0) break

      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id === null || item.metadata === null) await walk(path)
        else files.push(path)
      }
      if (data.length < 1000) break
      offset += data.length
    }
  }

  await walk('')
  return files
}

try {
  let total = 0
  for (const bucket of buckets) {
    const files = await listBucket(bucket)
    for (const path of files) {
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error || !data) throw new Error(`Téléchargement ${bucket}/${path} : ${error?.message ?? 'vide'}`)
      const target = join(dest, bucket, path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Buffer.from(await data.arrayBuffer()))
      total += 1
    }
    console.log(`${bucket} : ${files.length} fichier(s)`)
  }
  console.log(`Fichiers sauvegardés : ${total}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
