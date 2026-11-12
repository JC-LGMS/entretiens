<script lang="ts">
  import { onMount } from 'svelte'
  import { signOut } from '../lib/auth'
  import { disablePush, enablePush, getPushStatus, isStandalone, pushSupported, type PushStatus } from '../lib/push'
  import { setCurrentProfile } from '../lib/profiles'
  import { navigate } from '../lib/router.svelte'
  import { app } from '../lib/state.svelte'
  import { syncNow } from '../lib/sync'
  import { setTheme, themeState, type Theme } from '../lib/theme'
  let push = $state<PushStatus | 'loading'>('loading')
  let pushBusy = $state(false)
  let pushError = $state('')
  let syncBusy = $state(false)

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

  onMount(() => {
    void refreshPush()
  })

  async function refreshPush() {
    try {
      push = await getPushStatus()
    } catch (err) {
      push = 'unsubscribed'
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
