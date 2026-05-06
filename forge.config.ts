import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    appId: 'com.rivet.app',
    name: 'Rivet',
    executableName: 'rivet',
    // 原生 .node 不能留在 asar 内。
    asar: { unpack: '**/*.node' },
    icon: 'assets/icon',
    // Forge 的 Vite 插件默认只拷 .vite；主进程外置依赖（ssh2/undici 等）
    // 必须随 node_modules 一起打包，具体生产依赖由 packager 的 pruner 过滤。
    ignore: (file: string) => {
      if (!file) return false
      if (file.startsWith('/node_modules/.ignored') || file.startsWith('/node_modules/.cache')) {
        return true
      }
      return !(
        file === '/package.json' ||
        file.startsWith('/.vite') ||
        file.startsWith('/node_modules')
      )
    },
    // universal 构建会先分别打包 x64/arm64 切片再合并。FusesPlugin 只有在没有
    // osxSign 配置时才会对 arm64 切片执行 codesign --deep，给切片凭空加上
    // _CodeSignature/CodeResources，导致 @electron/universal 因两侧文件集合不同而失败。
    // 声明 osxSign 后改由 packager 在拼接完成后统一签名；无证书时它会警告并继续。
    osxSign: true,
    // 两个切片共用同一份 node_modules，原生模块只有构建机那一种架构、字节相同且无法 lipo，
    // 只能整体放行；ssh2 绑定加载失败会退回纯 JS，@oxc-parser 运行时不会加载。
    osxUniversal: {
      x64ArchFiles: '**/node_modules/**/*.node',
    },
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
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
