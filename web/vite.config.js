import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site at https://<user>.github.io/<repo>/, so built
// files need the repo name as their base path. `vite build` and `vite preview`
// (which serves the build) use it; the dev server stays at /.
const REPO_BASE = '/hayabusa-lunar-navigator/'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? REPO_BASE : '/',
  plugins: [react()],
}))
