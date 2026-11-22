<script lang="ts">
  import { onMount } from 'svelte'
  import { liveQuery } from 'dexie'
  import { BACKUP_REMINDER_DAYS, backupAgeDays, exportBackup } from './lib/backup'
  import { db } from './lib/db'
  import { todayISO } from './lib/dates'
  import { initAuth } from './lib/auth'
  import { loadCurrentProfile } from './lib/profiles'
  import { applyPwaUpdate, needRefresh } from './lib/pwa'
  import { syncExistingSubscription } from './lib/push'
  import { navigate, route } from './lib/router.svelte'
  import { app } from './lib/state.svelte'
  import { isConfigured } from './lib/supabase'
  import { startSync, syncNow } from './lib/sync'
  import { themeState, toggleTheme } from './lib/theme'
  import { APP_VERSION } from './lib/version'
  import Icon from './components/Icon.svelte'
  import SyncDialog from './components/SyncDialog.svelte'
  import ConfigMissing from './views/ConfigMissing.svelte'
  import Entities from './views/Entities.svelte'
  import EntityDetail from './views/EntityDetail.svelte'
  import Login from './views/Login.svelte'
  import Planning from './views/Planning.svelte'
  import ProfileHistory from './views/ProfileHistory.svelte'
  import ProfilePicker from './views/ProfilePicker.svelte'
  import Profiles from './views/Profiles.svelte'
  import Settings from './views/Settings.svelte'
  import Trash from './views/Trash.svelte'

  let started = false
  let showSync = $state(false)
  let backupDays = $state<number | null>(backupAgeDays())
  let backupBusy = $state(false)

  async function saveBackup() {
    backupBusy = true
    try {
      await exportBackup()
      backupDays = backupAgeDays()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      backupBusy = false
    }
  }

  onMount(() => {
    if (navigator.storage?.persist) void navigator.storage.persist()
    void (async () => {
      try {
        await initAuth()
        if (app.session) await loadCurrentProfile()
      } finally {
        app.ready = true
      }
    })()
    return startSync()
  })

  $effect(() => {
    const profileId = app.profileId
    if (!profileId) {
      ;(navigator as any).clearAppBadge?.()
      return
    }
    const sub = liveQuery(async () => {
      const entities = new Map(
        (await db.entities.toArray())
          .filter((entity) => !entity.deleted_at && !entity.archived)
          .map((entity) => [entity.id, entity])
      )
      return (await db.actions.toArray()).filter(
        (action) =>
          !action.deleted_at &&
          !action.archived &&
          action.active &&
          entities.has(action.entity_id) &&
          action.next_due <= todayISO()
      ).length
    }).subscribe((count) => {
      const nav = navigator as any
      if (count > 0) nav.setAppBadge?.(count)
      else nav.clearAppBadge?.()
    })
    return () => sub.unsubscribe()
  })

  $effect(() => {
    if (!app.session) {
      started = false
      return
    }
    if (started) return
    started = true
    void (async () => {
      await syncNow()
      await loadCurrentProfile()
      await syncExistingSubscription()
    })()
  })

  const initial = $derived((app.profile?.name ?? '?').slice(0, 1).toUpperCase())

  const syncTitle = $derived(
    app.sync === 'syncing'
      ? 'Synchronisation…'
      : app.sync === 'error'
        ? app.syncError || 'Erreur de synchronisation'
        : app.sync === 'offline'
          ? 'Hors ligne'
          : 'À jour'
  )
</script>

{#if !app.ready}
  <div class="login-wrap">
    <div class="stack" style="text-align:center;justify-items:center">
      <div class="logo" aria-hidden="true">
        <img src="/icons/icon-192.png" alt="" />
      </div>
      <p class="muted">Chargement…</p>
    </div>
  </div>
{:else if !isConfigured}
  <ConfigMissing />
{:else if !app.session}
  <Login />
{:else if !app.profile}
  <ProfilePicker />
{:else}
  <div class="shell">
    {#if $needRefresh}
      <div class="update-banner">
        <span>Nouvelle version disponible.</span>
        <button class="btn btn-sm btn-primary" onclick={applyPwaUpdate}>Mettre à jour</button>
      </div>
    {/if}

    {#if app.conflicts > 0}
      <button type="button" class="conflict-banner" onclick={() => (showSync = true)}>
        <span>
          ⚠️ {app.conflicts} conflit{app.conflicts > 1 ? 's' : ''} de synchronisation à résoudre.
        </span>
        <span class="conflict-action">Traiter</span>
      </button>
    {/if}

    {#if backupDays !== null && backupDays >= BACKUP_REMINDER_DAYS}
      <div class="backup-banner">
        <span>💾 Dernière sauvegarde il y a {backupDays} jours.</span>
        <button class="btn btn-sm btn-primary" onclick={saveBackup} disabled={backupBusy}>
          {backupBusy ? '…' : 'Sauvegarder'}
        </button>
      </div>
    {/if}

    <header class="topbar">
      <a class="brand" href="#/" aria-label="Entretiens, retour au planning">
        <span class="brand-logo" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" />
        </span>
        <span class="brand-text">
          <strong>Entretiens</strong>
          <small>v{APP_VERSION}</small>
        </span>
      </a>

      <nav class="desktop-nav" aria-label="Navigation">
        <a href="#/" class:active={route.current.name === 'planning'}><Icon name="calendar" size={16} /> Planning</a>
        <a href="#/entities" class:active={route.current.name === 'entities'}><Icon name="entities" size={16} /> Entités</a>
        <a href="#/profiles" class:active={route.current.name === 'profiles' || route.current.name === 'profile'}><Icon name="users" size={16} /> Comptes</a>
        <a href="#/settings" class:active={route.current.name === 'settings'}><Icon name="settings" size={16} /> Réglages</a>
      </nav>

      <button
        class="sync-button"
        title={syncTitle}
        aria-label={syncTitle}
        onclick={() => (showSync = true)}
      >
        <span class={`sync-dot ${app.sync}`}></span>
      </button>

      <button
        class="btn icon-btn"
        style="border-color:transparent;background:transparent"
        aria-label={$themeState.resolved === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
        title={$themeState.resolved === 'dark' ? 'Thème clair' : 'Thème sombre'}
        onclick={toggleTheme}
      >
        <Icon name={$themeState.resolved === 'dark' ? 'sun' : 'moon'} size={20} />
      </button>

      <button
        class="btn icon-btn"
        style="border-color:transparent;background:transparent"
        aria-label="Profil et réglages"
        onclick={() => navigate('/settings')}
      >
        <span class="avatar" style="width:32px;height:32px">{initial}</span>
      </button>
    </header>

    <main class="container">
      {#if route.current.name === 'planning'}
        <Planning />
      {:else if route.current.name === 'entities'}
        <Entities />
      {:else if route.current.name === 'settings'}
        <Settings />
      {:else if route.current.name === 'trash'}
        <Trash />
      {:else if route.current.name === 'profiles'}
        <Profiles />
      {:else if route.current.name === 'profile'}
        <ProfileHistory id={route.current.id} />
      {:else if route.current.name === 'entity'}
        <EntityDetail id={route.current.id} focusActionId={route.current.actionId} />
      {/if}
    </main>

    <nav class="bottom-nav" aria-label="Navigation">
      <a href="#/" class:active={route.current.name === 'planning'}>
        <Icon name="calendar" size={22} />
        <span>Planning</span>
      </a>
      <a href="#/entities" class:active={route.current.name === 'entities'}>
        <Icon name="entities" size={22} />
        <span>Entités</span>
      </a>
      <a href="#/settings" class:active={route.current.name === 'settings'}>
        <Icon name="settings" size={22} />
        <span>Réglages</span>
      </a>
    </nav>

    {#if showSync}
      <SyncDialog onclose={() => (showSync = false)} />
    {/if}
  </div>
{/if}
