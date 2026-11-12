<script lang="ts">
  import { onMount } from 'svelte'
  import { initAuth } from './lib/auth'
  import { loadCurrentProfile } from './lib/profiles'
  import { syncExistingSubscription } from './lib/push'
  import { navigate, route } from './lib/router.svelte'
  import { app } from './lib/state.svelte'
  import { isConfigured } from './lib/supabase'
  import { startSync, syncNow } from './lib/sync'
  import { themeState, toggleTheme } from './lib/theme'
  import ConfigMissing from './views/ConfigMissing.svelte'
  import Entities from './views/Entities.svelte'
  import EntityDetail from './views/EntityDetail.svelte'
  import Login from './views/Login.svelte'
  import Planning from './views/Planning.svelte'
  import ProfileHistory from './views/ProfileHistory.svelte'
  import ProfilePicker from './views/ProfilePicker.svelte'
  import Profiles from './views/Profiles.svelte'
  import Settings from './views/Settings.svelte'

  let started = false

  onMount(() => {
    if (navigator.storage?.persist) void navigator.storage.persist()
    void initAuth().finally(() => {
      app.ready = true
    })
    return startSync()
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
      <div class="logo" aria-hidden="true">🌿</div>
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
    <header class="topbar">
      <div class="brand">
        <strong>Entretiens</strong>
        <small>{app.profile.name}</small>
      </div>

      <nav class="desktop-nav" aria-label="Navigation">
        <a href="#/" class:active={route.current.name === 'planning'}>Planning</a>
        <a href="#/entities" class:active={route.current.name === 'entities'}>Entités</a>
        <a href="#/profiles" class:active={route.current.name === 'profiles' || route.current.name === 'profile'}>Comptes</a>
        <a href="#/settings" class:active={route.current.name === 'settings'}>Réglages</a>
      </nav>

      <span class={`sync-dot ${app.sync}`} title={syncTitle} aria-label={syncTitle}></span>

      <button
        class="btn icon-btn"
        style="border-color:transparent;background:transparent"
        aria-label={$themeState.resolved === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
        title={$themeState.resolved === 'dark' ? 'Thème clair' : 'Thème sombre'}
        onclick={toggleTheme}
      >
        {$themeState.resolved === 'dark' ? '☀️' : '🌙'}
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
      {:else if route.current.name === 'profiles'}
        <Profiles />
      {:else if route.current.name === 'profile'}
        <ProfileHistory id={route.current.id} />
      {:else if route.current.name === 'entity'}
        <EntityDetail id={route.current.id} />
      {/if}
    </main>

    <nav class="bottom-nav" aria-label="Navigation">
      <a href="#/" class:active={route.current.name === 'planning'}>
        <span aria-hidden="true">📅</span>
        <span>Planning</span>
      </a>
      <a href="#/entities" class:active={route.current.name === 'entities'}>
        <span aria-hidden="true">🗂️</span>
        <span>Entités</span>
      </a>
      <a href="#/settings" class:active={route.current.name === 'settings'}>
        <span aria-hidden="true">⚙️</span>
        <span>Réglages</span>
      </a>
    </nav>
  </div>
{/if}
