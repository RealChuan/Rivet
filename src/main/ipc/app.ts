import { appContract, appOneWayContract } from '@shared/contract/app.contract.js'
import { ok } from '@shared/domain/result.js'
import { confirmClose } from '../app/close-guard.js'
import { refreshTrayMenu } from '../app/tray.js'
import { applyWindowTheme } from '../app/window-theme.js'
import { setMainLocale } from '../i18n/index.js'
import { registerContract, registerOneWay } from './register.js'

export function setupAppIpcHandlers(): void {
  registerContract(appContract, {
    'app.confirmClose': () => {
      confirmClose()
      return ok(undefined)
    },
  })

  registerOneWay(appOneWayContract, {
    'app.setTheme': (_sender, theme) => {
      applyWindowTheme(theme)
    },
    'app.setLocale': async (_sender, locale) => {
      await setMainLocale(locale)
      refreshTrayMenu()
    },
  })
}
