import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { registerPwa } from './lib/pwa'
import { initTheme } from './lib/theme'

registerPwa()
initTheme()

const app = mount(App, { target: document.getElementById('app')! })

export default app
