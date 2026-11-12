import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { initTheme } from './lib/theme'

registerSW({ immediate: true })
initTheme()

const app = mount(App, { target: document.getElementById('app')! })

export default app
