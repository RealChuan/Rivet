import { useTranslation } from 'react-i18next'
import { TERMINAL_FONT_SIZE } from '@shared/constants/index.js'
import Select from '../../../components/ui/Select.js'
import { useUiStore } from '../../../stores/ui.js'
import { SettingsRow } from './SettingsRow.js'

const FONT_SIZE_OPTIONS = Array.from(
  { length: TERMINAL_FONT_SIZE.MAX - TERMINAL_FONT_SIZE.MIN + 1 },
  (_, index) => {
    const size = String(TERMINAL_FONT_SIZE.MIN + index)
    return { label: `${size} px`, value: size }
  },
)

export const TerminalSection = () => {
  const { t } = useTranslation()
  const terminalFontSize = useUiStore((state) => state.terminalFontSize)
  const setTerminalFontSize = useUiStore((state) => state.setTerminalFontSize)

  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingsRow
        label={t(($) => $.settings.terminalFontSize.label)}
        description={t(($) => $.settings.terminalFontSize.hint)}
      >
        <Select
          testId="terminal-font-size"
          ariaLabel={t(($) => $.settings.terminalFontSize.label)}
          value={String(terminalFontSize)}
          onChange={(value) => setTerminalFontSize(Number.parseInt(value, 10))}
          options={FONT_SIZE_OPTIONS}
          className="w-24 min-h-8 py-1 text-xs"
        />
      </SettingsRow>
    </div>
  )
}

export default TerminalSection
