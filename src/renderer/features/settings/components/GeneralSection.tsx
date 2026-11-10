import { useTranslation } from 'react-i18next'
import { CLOSE_BEHAVIOR } from '@shared/constants/index.js'
import { Select } from '../../../components/ui/index.js'
import { useUiStore } from '../../../stores/index.js'
import SettingsRow from './SettingsRow.js'

export const GeneralSection = () => {
  const { t } = useTranslation()
  const closeBehavior = useUiStore((state) => state.closeBehavior)
  const setCloseBehavior = useUiStore((state) => state.setCloseBehavior)

  const options = [
    { value: CLOSE_BEHAVIOR.TRAY, label: t(($) => $.settings.closeBehavior.tray) },
    { value: CLOSE_BEHAVIOR.QUIT, label: t(($) => $.settings.closeBehavior.quit) },
  ]

  const handleChange = (value: string) => {
    if (value === CLOSE_BEHAVIOR.TRAY || value === CLOSE_BEHAVIOR.QUIT) {
      setCloseBehavior(value)
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingsRow
        label={t(($) => $.settings.closeBehavior.label)}
        description={t(($) => $.settings.closeBehavior.hint)}
      >
        <Select
          value={closeBehavior}
          onChange={handleChange}
          options={options}
          ariaLabel={t(($) => $.settings.closeBehavior.label)}
          testId="close-behavior"
          className="w-44"
        />
      </SettingsRow>
    </div>
  )
}

export default GeneralSection
