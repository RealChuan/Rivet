import { Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, GlassDialog } from '../../../components/ui/index.js'
import { cn } from '../../../utils/index.js'
import { ConcurrencyFields } from '../../transfer/components/ConcurrencyFields.js'
import FilesSection from './FilesSection.js'
import GeneralSection from './GeneralSection.js'
import MaintenanceSection from './MaintenanceSection.js'

const SETTINGS_SECTION = {
  GENERAL: 'general',
  TRANSFER: 'transfer',
  FILES: 'files',
  MAINTENANCE: 'maintenance',
} as const

type SettingsSection = (typeof SETTINGS_SECTION)[keyof typeof SETTINGS_SECTION]

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * 应用设置：顶部标签切换分区，内容占满剩余高度并自行滚动。
 * 分区少的时候标签比侧边导航省空间；窗口可右下角拉伸，后续加条目不用重排。
 */
export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const { t } = useTranslation()
  const [active, setActive] = useState<SettingsSection>(SETTINGS_SECTION.GENERAL)

  const sections = [
    { id: SETTINGS_SECTION.GENERAL, label: t(($) => $.settings.general) },
    { id: SETTINGS_SECTION.TRANSFER, label: t(($) => $.settings.transfer) },
    { id: SETTINGS_SECTION.FILES, label: t(($) => $.settings.files) },
    { id: SETTINGS_SECTION.MAINTENANCE, label: t(($) => $.settings.maintenance) },
  ] as const

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      resizable
      width={640}
      height={400}
      minWidth={520}
      minHeight={300}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 stroke-text-muted stroke-2" />
          </div>
          <h2 className="text-base font-semibold text-text">{t(($) => $.settings.title)}</h2>
        </div>

        <div className="mt-4 flex-1 min-h-0 flex gap-4">
          <nav
            aria-label={t(($) => $.settings.title)}
            className="w-32 shrink-0 flex flex-col gap-0.5 overflow-y-auto"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-current={active === section.id ? 'true' : undefined}
                onClick={() => setActive(section.id)}
                className={cn(
                  'px-2.5 py-2 rounded-md text-left text-xs bg-transparent transition-colors',
                  active === section.id
                    ? 'bg-selected text-accent font-medium'
                    : 'text-text-muted hover:bg-hover hover:text-text',
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="w-px bg-border shrink-0" />

          <div className="flex-1 min-w-0 overflow-y-auto pl-1">
            {active === SETTINGS_SECTION.GENERAL && <GeneralSection />}
            {active === SETTINGS_SECTION.TRANSFER && <ConcurrencyFields />}
            {active === SETTINGS_SECTION.FILES && <FilesSection />}
            {active === SETTINGS_SECTION.MAINTENANCE && <MaintenanceSection />}
          </div>
        </div>

        <div className="shrink-0 pt-4 flex justify-end">
          <Button variant="secondary" className="px-3.5 py-1.5 text-xs" onClick={onClose}>
            {t(($) => $.common.action.close)}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}

export default SettingsDialog
