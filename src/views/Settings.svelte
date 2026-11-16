<script lang="ts">
  import { onMount } from 'svelte'
  import { signOut } from '../lib/auth'
  import { exportBackup, importBackup } from '../lib/backup'
  import {
    currentPushEndpoint,
    disablePush,
    enablePush,
    getPushStatus,
    isStandalone,
    listPushSubscriptions,
    pushSupported,
    revokePushSubscription,
    type PushStatus
  } from '../lib/push'
  import { setCurrentProfile } from '../lib/profiles'
  import { navigate } from '../lib/router.svelte'
  import { app } from '../lib/state.svelte'
  import { syncNow } from '../lib/sync'
  import { setTheme, themeState, type Theme } from '../lib/theme'
  import { APP_VERSION } from '../lib/version'
  import type { PushSubscriptionRow } from '../lib/types'
  import ChangelogDialog from '../components/ChangelogDialog.svelte'
  import SyncDialog from '../components/SyncDialog.svelte'
  import TemplateEditor from '../components/TemplateEditor.svelte'

  let push = $state<PushStatus | 'loading'>('loading')
  let pushBusy = $state(false)
  let pushError = $state('')
  let syncBusy = $state(false)
  let showChangelog = $state(false)
  let showSync = $state(false)
  let showTemplates = $state(false)
  let devices = $state<PushSubscriptionRow[]>([])
  let currentEndpoint = $state<string | null>(null)
  let dataBusy = $state(false)
  let dataError = $state('')

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

  onMount(() => {
    void refreshPush()
    void refreshDevices()
  })

  async function refreshPush() {
    try {
      push = await getPushStatus()
    } catch (err) {
      push = 'unsubscribed'
      pushError = err instanceof Error ? err.message : String(err)
    }
  }

  async function refreshDevices() {
    try {
      currentEndpoint = await currentPushEndpoint()
      devices = await listPushSubscriptions()
    } catch (err) {
      pushError = err instanceof Error ? err.message : String(err)
    }
  }

  async function togglePush() {
    pushBusy = true
    pushError = ''
    try {
      if (push === 'subscribed') await disablePush()
      else await enablePush()
      await refreshPush()
      await refreshDevices()
    } catch (err) {
      pushError = err instanceof Error ? err.message : String(err)
    } finally {
      pushBusy = false
    }
  }

  async function revokeDevice(endpoint: string) {
    if (!confirm('Révoquer cet appareil ? Il ne recevra plus de notifications.')) return
    pushBusy = true
    pushError = ''
    try {
      if (endpoint === currentEndpoint) await disablePush()
      else await revokePushSubscription(endpoint)
      await refreshPush()
      await refreshDevices()
    } catch (err) {
      pushError = err instanceof Error ? err.message : String(err)
    } finally {
      pushBusy = false
    }
  }

  async function sync() {
    syncBusy = true
    await syncNow()
    syncBusy = false
  }

  async function doExport() {
    dataBusy = true
    dataError = ''
    try {
      await exportBackup()
    } catch (err) {
      dataError = err instanceof Error ? err.message : String(err)
    } finally {
      dataBusy = false
    }
  }

  async function doImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!confirm('Importer cette archive ? Les éléments existants seront fusionnés par identifiant.')) {
      input.value = ''
      return
    }
    dataBusy = true
    dataError = ''
    try {
      await importBackup(file)
      await syncNow()
      input.value = ''
    } catch (err) {
      dataError = err instanceof Error ? err.message : String(err)
    } finally {
      dataBusy = false
    }
  }

  function lastSeenLabel(value: string): string {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
  }

  function syncLabel(): string {
    if (!navigator.onLine) return 'Hors ligne'
    if (app.sync === 'syncing') return 'Synchronisation…'
    if (app.sync === 'error') return 'Erreur de synchronisation'
    if (app.sync === 'offline') return 'Hors ligne'
    return 'Synchronisé'
  }

  function lastSyncLabel(): string {
    if (!app.lastSync) return 'Jamais synchronisé'
    return new Date(app.lastSync).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const pushLabel = $derived(
    push === 'loading'
      ? 'Vérification…'
      : push === 'subscribed'
        ? 'Activées sur cet appareil'
        : push === 'denied'
          ? 'Refusées dans le navigateur'
          : push === 'unsupported'
            ? 'Non supportées'
            : 'Désactivées'
  )
</script>

<div class="section-title"><h2>Profil</h2></div>
<div class="card card-pad">
  <div class="row">
    <span class="avatar">{(app.profile?.name ?? '?').slice(0, 1).toUpperCase()}</span>
    <div class="entity-main">
      <strong>{app.profile?.name ?? 'Aucun profil'}</strong>
      <small>Attribution déclarative, visible dans l'historique.</small>
    </div>
    <button class="btn btn-sm" onclick={() => setCurrentProfile(null)}>Changer</button>
  </div>
  <div class="settings-row" style="margin-top:10px">
    <div class="grow">
      <strong>Comptes et historiques</strong>
      <p class="muted tiny">Voir l'activité de chaque profil.</p>
    </div>
    <button class="btn btn-sm" onclick={() => navigate('/profiles')}>Ouvrir</button>
  </div>
</div>

<div class="section-title"><h2>Apparence</h2></div>
<div class="card card-pad">
  <div class="chips">
    <button class="chip" class:active={$themeState.mode === 'system'} onclick={() => chooseTheme('system')}>Système</button>
    <button class="chip" class:active={$themeState.mode === 'light'} onclick={() => chooseTheme('light')}>Clair</button>
    <button class="chip" class:active={$themeState.mode === 'dark'} onclick={() => chooseTheme('dark')}>Sombre</button>
  </div>
  <p class="muted tiny" style="margin-top:8px">Choix enregistré sur cet appareil.</p>
</div>

<div class="section-title"><h2>Modèles d’actions</h2></div>
<div class="card card-pad">
  <div class="settings-row">
    <div class="grow">
      <strong>Modèles proposés</strong>
      <p class="muted tiny">Modifier les noms, fréquences et checklists proposés lors de la création d’une action.</p>
    </div>
    <button class="btn btn-sm" onclick={() => (showTemplates = true)}>Gérer</button>
  </div>
  <p class="muted tiny" style="margin-top:6px">Modèles synchronisés et partagés par tous les profils.</p>
</div>

<div class="section-title"><h2>Notifications</h2></div>
<div class="card card-pad">
  <div class="settings-row">
    <div class="grow">
      <strong>Rappels du jour J</strong>
      <p class="muted tiny">{pushLabel}</p>
    </div>
    <button
      class="btn btn-sm {push === 'subscribed' ? 'btn-danger' : 'btn-soft'}"
      onclick={togglePush}
      disabled={pushBusy || push === 'unsupported' || push === 'denied' || push === 'loading'}
    >
      {pushBusy ? '…' : push === 'subscribed' ? 'Désactiver' : 'Activer'}
    </button>
  </div>
  {#if isIOS && !isStandalone()}
    <p class="notice" style="margin-top:10px">
      Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil, puis activez les notifications.
    </p>
  {/if}
  {#if pushError}<p class="error" style="margin-top:10px">{pushError}</p>{/if}
</div>

{#if devices.length}
  <div class="section-title"><h2>Appareils abonnés</h2></div>
  <div class="card card-pad">
    {#each devices as device (device.endpoint)}
      <div class="settings-row">
        <div class="grow">
          <strong>{device.label || 'Appareil'}</strong>
          <p class="muted tiny">
            {lastSeenLabel(device.last_seen)}
            {#if device.endpoint === currentEndpoint} · cet appareil{/if}
          </p>
        </div>
        <button class="btn btn-sm btn-danger" onclick={() => revokeDevice(device.endpoint)} disabled={pushBusy}>
          Révoquer
        </button>
      </div>
    {/each}
  </div>
{/if}

<div class="section-title"><h2>Synchronisation</h2></div>
<div class="card card-pad">
  <div class="settings-row">
    <span class={`sync-dot ${app.sync}`} aria-hidden="true"></span>
    <div class="grow">
      <strong>{syncLabel()}</strong>
      <p class="muted tiny">{lastSyncLabel()}</p>
    </div>
    <button class="btn btn-sm" onclick={sync} disabled={syncBusy}>
      {syncBusy ? '…' : 'Synchroniser'}
    </button>
  </div>
  {#if app.syncError}<p class="error" style="margin-top:10px">{app.syncError}</p>{/if}
  <p class="muted tiny" style="margin-top:10px">
    Les modifications sont enregistrées localement puis envoyées dès que le réseau revient.
  </p>
</div>

<div class="section-title"><h2>Données</h2></div>
<div class="card card-pad">
  <div class="settings-row">
    <div class="grow">
      <strong>Exporter</strong>
      <p class="muted tiny">JSON + photos + documents dans une archive ZIP.</p>
    </div>
    <button class="btn btn-sm" onclick={doExport} disabled={dataBusy}>
      {dataBusy ? '…' : 'Exporter'}
    </button>
  </div>
  <div class="settings-row">
    <div class="grow">
      <strong>Importer</strong>
      <p class="muted tiny">Fusion par identifiant, photos incluses.</p>
    </div>
    <label class="btn btn-sm">
      Importer
      <input type="file" accept=".zip,application/zip" style="display:none" onchange={doImport} />
    </label>
  </div>
  <div class="settings-row">
    <div class="grow">
      <strong>Corbeille</strong>
      <p class="muted tiny">Restaurer une entité, une action ou une réalisation.</p>
    </div>
    <button class="btn btn-sm" onclick={() => navigate('/trash')}>Ouvrir</button>
  </div>
  <div class="settings-row">
    <div class="grow">
      <strong>Conflits de synchronisation</strong>
      <p class="muted tiny">{app.conflicts} conflit{app.conflicts > 1 ? 's' : ''} en attente.</p>
    </div>
    <button class="btn btn-sm" onclick={() => (showSync = true)}>Détails</button>
  </div>
  {#if dataError}<p class="error" style="margin-top:10px">{dataError}</p>{/if}
</div>

<div class="section-title"><h2>Compte</h2></div>
<div class="card card-pad">
  <div class="settings-row">
    <div class="grow">
      <strong>Accès partagé</strong>
      <p class="muted tiny">Une seule connexion pour tous les profils.</p>
    </div>
    <button class="btn btn-sm btn-danger" onclick={() => signOut()}>Déconnexion</button>
  </div>
</div>

<p class="muted tiny" style="text-align:center;margin-top:18px">
  Entretiens · données partagées, synchronisation locale d'abord.
</p>
<button
  class="btn btn-ghost btn-sm"
  style="margin:6px auto 0;display:flex"
  onclick={() => (showChangelog = true)}
>
  Version {APP_VERSION}
</button>

{#if showChangelog}
  <ChangelogDialog onclose={() => (showChangelog = false)} />
{/if}

{#if showSync}
  <SyncDialog onclose={() => (showSync = false)} />
{/if}

{#if showTemplates}
  <TemplateEditor onclose={() => (showTemplates = false)} />
{/if}
