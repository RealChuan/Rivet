/**
 * 应用程序基础配置常量
 */

/**
 * 应用程序名称
 */
export const APP_NAME = 'Rivet'

/**
 * 应用程序版本号
 */
export const APP_VERSION = '0.0.1'

/**
 * 主窗口唯一标识
 */
export const MAIN_WINDOW_ID = 'main'

/**
 * 主窗口默认宽度（像素）
 */
export const DEFAULT_MAIN_WINDOW_WIDTH = 1100

/**
 * 主窗口最小宽度（像素）
 */
export const MIN_MAIN_WINDOW_WIDTH = 800

/**
 * 主窗口默认高度（像素）
 */
export const DEFAULT_MAIN_WINDOW_HEIGHT = 700

/**
 * 主窗口最小高度（像素）
 */
export const MIN_MAIN_WINDOW_HEIGHT = 600

export const DEFAULT_PANEL_WIDTH = 240

export const MIN_PANEL_WIDTH = 180

export const MAX_PANEL_WIDTH = 400

export const STORE_KEY = {
  SAVED_CONNECTIONS: 'savedConnections',
  UI_SETTINGS: 'uiSettings',
  KNOWN_HOSTS: 'knownHosts',
} as const

export type StoreKey = (typeof STORE_KEY)[keyof typeof STORE_KEY]

export const STORE_NAME = {
  KNOWN_HOSTS: 'known-hosts',
} as const

export const ROOT_PATH = '/'
export const DEFAULT_ROUTE = '/'
