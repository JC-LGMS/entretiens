import { app } from './state.svelte'
import { supabase, workspaceEmail } from './supabase'

export async function initAuth(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  app.session = data.session
  supabase.auth.onAuthStateChange((_event, session) => {
    app.session = session
  })
}

export async function signIn(code: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  if (!workspaceEmail) throw new Error('VITE_WORKSPACE_EMAIL manquant')
  const { error } = await supabase.auth.signInWithPassword({
    email: workspaceEmail,
    password: code
  })
  if (error) throw new Error('Code incorrect ou accès impossible')
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  app.profileId = null
  app.profile = null
}
