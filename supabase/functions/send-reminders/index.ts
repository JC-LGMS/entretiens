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

const headers = { 'Content-Type': 'application/json' }

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers })
  }
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers })
  }
  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'vapid_missing' }), { status: 500, headers })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error: dueError } = await admin
    .from('actions')
    .select('id, label, next_due, entity_id, entities(name)')
    .eq('next_due', today)
    .eq('active', true)
    .is('deleted_at', null)
    .or(`notified_for.is.null,notified_for.neq.${today}`)

  if (dueError) {
    return new Response(JSON.stringify({ error: dueError.message }), { status: 500, headers })
  }
  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, actions: 0 }), { headers })
  }

  const { data: subscriptions, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), { status: 500, headers })
  }
  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, actions: due.length }), { headers })
  }

  const stale = new Set<string>()
  let sent = 0

  for (const action of due) {
    const relation = action.entities as unknown
    const entityName = Array.isArray(relation)
      ? (relation[0] as { name?: string } | undefined)?.name
      : (relation as { name?: string } | null)?.name
    const payload = JSON.stringify({
      title: 'Entretien à prévoir',
      body: `${entityName ?? 'Entité'} · ${action.label}`,
      entityId: action.entity_id,
      actionId: action.id,
      url: '/#/planning'
    })

    let delivered = 0
    for (const subscription of subscriptions) {
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
      }
    }

    if (delivered > 0) {
      await admin.from('actions').update({ notified_for: today }).eq('id', action.id)
    }
  }

  if (stale.size > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', [...stale])
  }

  return new Response(JSON.stringify({ sent, actions: due.length }), { headers })
})
