import { useTranslation } from 'react-i18next'
import { Checkbox } from '../../../components/ui/index.js'
import { useUiStore } from '../../../stores/index.js'
import SettingsRow from './SettingsRow.js'

export const FilesSection = () => {
  const { t } = useTranslation()
  const showHiddenFiles = useUiStore((state) => state.showHiddenFiles)
  const setShowHiddenFiles = useUiStore((state) => state.setShowHiddenFiles)

  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingsRow
        label={t(($) => $.settings.hiddenFiles.label)}
        description={t(($) => $.settings.hiddenFiles.hint)}
      >
        <Checkbox checked={showHiddenFiles} onChange={setShowHiddenFiles} />
      </SettingsRow>
    </div>
  )
}

export default FilesSection
