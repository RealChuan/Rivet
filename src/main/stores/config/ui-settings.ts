import { DEFAULT_THEME_VALUE, SORT_ORDER } from '@shared/constants/index.js'
import { type UiSettings } from '@shared/types/index.js'

export const defaultUiSettings: UiSettings = {
  appearance: DEFAULT_THEME_VALUE,
  locale: '',
  connectionSortOrder: SORT_ORDER.NONE,
}
