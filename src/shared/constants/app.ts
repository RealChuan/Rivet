/**
 * 应用程序基础配置常量
 */

/**
 * 应用程序名称
 */
export const APP_NAME = 'Rivet'

/**
 * 主窗口唯一标识
 */
export const MAIN_WINDOW_ID = 'mainwindow'

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

export const MIN_PANEL_WIDTH = 100

export const MAX_PANEL_WIDTH = 400

export const STORE_KEY = {
  SAVED_CONNECTIONS: 'savedConnections',
  UI_SETTINGS: 'uiSettings',
  TRANSFER_SETTINGS: 'transferSettings',
  KNOWN_HOSTS: 'knownHosts',
  CONNECTION_SORT_ORDER: 'connectionSortOrder',
} as const

export type StoreKey = (typeof STORE_KEY)[keyof typeof STORE_KEY]

export const STORE_NAME = {
  KNOWN_HOSTS: 'known-hosts',
} as const

export const ROOT_PATH = '/'
export const DEFAULT_ROUTE = '/'

/** 子窗口默认宽度 */
export const DEFAULT_CHILD_WINDOW_WIDTH = DEFAULT_MAIN_WINDOW_WIDTH
/** 子窗口默认高度 */
export const DEFAULT_CHILD_WINDOW_HEIGHT = DEFAULT_MAIN_WINDOW_HEIGHT
/** 子窗口最小宽度 */
export const DEFAULT_CHILD_WINDOW_MIN_WIDTH = MIN_MAIN_WINDOW_WIDTH
/** 子窗口最小高度 */
export const DEFAULT_CHILD_WINDOW_MIN_HEIGHT = MIN_MAIN_WINDOW_HEIGHT
/** macOS 交通灯位置 */
export const MACOS_TRAFFIC_LIGHT_POSITION = { x: 16, y: 14 } as const
/** 开发服务器 URL */
export const DEV_SERVER_URL = 'http://localhost:5173'

/** 连接面板默认宽度 */
export const DEFAULT_CONNECTION_PANEL_WIDTH = 260
/** 传输面板默认宽度 */
export const DEFAULT_TRANSFER_PANEL_WIDTH = 260
/** 队列抽屉默认宽度 */
export const DEFAULT_QUEUE_DRAWER_WIDTH = 360
/** 文件列表项高度 (px) */
export const FILE_ITEM_HEIGHT = 40
