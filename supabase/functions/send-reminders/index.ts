import { createClient } from 'npm:@supabase/supabase-js@2.105.0'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@example.com'
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const headers = { 'Content-Type': 'application/json', ...corsHeaders }

interface Subscription {
  endpoint: string
  p256dh: string
  auth: string
}

function dayDiff(dateISO: string, todayISO: string): number {
  const date = new Date(`${dateISO}T00:00:00Z`).getTime()
  const today = new Date(`${todayISO}T00:00:00Z`).getTime()
  return Math.round((date - today) / 86400000)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers })
  }
  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'vapid_missing' }), { status: 500, headers })
  }

  const body = (await request.json().catch(() => ({}))) as {
    test?: boolean
    endpoint?: string
  }
  const isTest = body.test === true

  if (isTest) {
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers })
    }
  } else if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers })
  }

  const today = new Date().toISOString().slice(0, 10)
  const stale = new Set<string>()
  const failures: (number | string)[] = []
  let sent = 0
  let actionCount = 0
  let warrantyCount = 0

  async function sendTo(
    targets: Subscription[],
    title: string,
    message: string,
    entityId?: string,
    actionId?: string,
    url = '/#/planning'
  ): Promise<number> {
    const payload = JSON.stringify({
      title,
      body: message,
      entityId: entityId ?? null,
      actionId: actionId ?? null,
      url
    })
    let delivered = 0
    for (const subscription of targets) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth }
          },
          payload,
          { TTL: 3600 }
        )
        delivered += 1
        sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) stale.add(subscription.endpoint)
        else failures.push(status ?? String(error))
      }
    }
    return delivered
  }

  if (isTest) {
    const base = admin.from('push_subscriptions').select('endpoint, p256dh, auth')
    const { data: testTargets, error } = body.endpoint
      ? await base.eq('endpoint', body.endpoint)
      : await base
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }
    const delivered = await sendTo(
      (testTargets ?? []) as Subscription[],
      'Test de notification',
      'Les rappels push fonctionnent sur cet appareil.',
      undefined,
      undefined,
      '/#/settings'
    )
    return new Response(JSON.stringify({ sent: delivered, failures }), {
      status: delivered > 0 ? 200 : 500,
      headers
    })
  }

  const { data: actions, error: actionsError } = await admin
    .from('actions')
    .select(
      'id, label, next_due, entity_id, notify_lead_days, overdue_repeat_days, last_notified_on, entities(name, archived, deleted_at)'
    )
    .eq('active', true)
    .is('deleted_at', null)

  if (actionsError) {
    return new Response(JSON.stringify({ error: actionsError.message }), { status: 500, headers })
  }

  const { data: subscriptions, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), { status: 500, headers })
  }

  const targets = (subscriptions ?? []) as Subscription[]

  for (const action of actions ?? []) {
    const relation = action.entities as unknown
    const entity = Array.isArray(relation)
      ? (relation[0] as { name?: string; archived?: boolean; deleted_at?: string | null } | undefined)
      : (relation as { name?: string; archived?: boolean; deleted_at?: string | null } | null)
    if (!entity || entity.archived || entity.deleted_at) continue

    const diff = dayDiff(action.next_due, today)
    const lead = action.notify_lead_days ?? 0
    const repeat = Math.max(1, action.overdue_repeat_days ?? 1)
    const leadDay = diff === lead
    const overdueDay = diff < 0 && -diff % repeat === 0
    if (!leadDay && !overdueDay) continue
    if (action.last_notified_on === today) continue

    const delivered = await sendTo(
      targets,
      'Entretien à prévoir',
      `${entity.name ?? 'Entité'} · ${action.label}`,
      action.entity_id,
      action.id
    )
    if (delivered > 0) {
      await admin.from('actions').update({ last_notified_on: today }).eq('id', action.id)
      actionCount += 1
    }
  }

  const { data: entities, error: entitiesError } = await admin
    .from('entities')
    .select('id, name, warranty_until, warranty_notified_on')
    .not('warranty_until', 'is', null)
    .is('deleted_at', null)
    .eq('archived', false)

  if (entitiesError) {
    return new Response(JSON.stringify({ error: entitiesError.message }), { status: 500, headers })
  }

  for (const entity of entities ?? []) {
    const diff = dayDiff(entity.warranty_until, today)
    if (diff !== 30 && diff !== 0) continue
    if (entity.warranty_notified_on === today) continue
    const delivered = await sendTo(
      targets,
      'Garantie à vérifier',
      `${entity.name} · garantie le ${entity.warranty_until}`,
      entity.id
    )
    if (delivered > 0) {
      await admin.from('entities').update({ warranty_notified_on: today }).eq('id', entity.id)
      warrantyCount += 1
    }
  }

  if (stale.size > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', [...stale])
  }

  return new Response(
    JSON.stringify({ sent, actions: actionCount, warranties: warrantyCount, failures }),
    { headers }
  )
})
