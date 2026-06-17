import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    appId: 'com.rivet.app',
    name: 'Rivet',
    executableName: 'rivet',
    asar: true,
    icon: 'assets/icon',
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['win32', 'darwin', 'linux'], config: {} },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: { options: { categories: ['Utility'] } },
    },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: {} },
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/app/main.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
}

export default config
