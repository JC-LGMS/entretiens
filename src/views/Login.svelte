<script lang="ts">
  import { signIn } from '../lib/auth'

  let code = $state('')
  let busy = $state(false)
  let error = $state('')

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = ''
    try {
      await signIn(code)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<div class="login-wrap">
  <form class="card login-card stack" onsubmit={submit}>
    <div class="logo" aria-hidden="true">🌿</div>
    <h1>Entretiens</h1>
    <p class="muted">Suivi et rappel des équipements, plantes et démarches.</p>

    <label class="field">
      <span>Code d'accès</span>
      <input
        type="password"
        bind:value={code}
        autocomplete="current-password"
        placeholder="Code partagé de la maison"
        required
      />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <button class="btn btn-primary" type="submit" disabled={busy}>
      {busy ? 'Connexion…' : 'Entrer'}
    </button>
    <p class="tiny muted">
      Ce code est défini une seule fois dans Supabase. Il protège l'accès aux données partagées.
    </p>
  </form>
</div>
