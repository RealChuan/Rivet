import { Settings2 } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import Select from '../../../components/ui/Select.js'
import { useTransferStore } from '../stores/transfer.js'

const CONCURRENCY_OPTIONS = Array.from(
  { length: TRANSFER_CONFIG.MAX_CONCURRENCY - TRANSFER_CONFIG.MIN_CONCURRENCY + 1 },
  (_, index) => {
    const value = String(index + TRANSFER_CONFIG.MIN_CONCURRENCY)
    return { label: value, value }
  },
)

export const QueueSettingsPopover = () => {
  const { t } = useTranslation()
  const maxUploadConcurrency = useTransferStore((state) => state.maxUploadConcurrency)
  const maxDownloadConcurrency = useTransferStore((state) => state.maxDownloadConcurrency)
  const setMaxUploadConcurrency = useTransferStore((state) => state.setMaxUploadConcurrency)
  const setMaxDownloadConcurrency = useTransferStore((state) => state.setMaxDownloadConcurrency)

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-hover transition-colors cursor-default focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
          aria-label={t(($) => $.transfer.queue.settings)}
          title={t(($) => $.transfer.queue.settings)}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          className="z-50 w-56 p-3 rounded-lg border border-glass-border bg-glass-bg shadow-dropdown animate-menu-in"
        >
          <div className="flex items-center gap-3 justify-between mb-2">
            <span className="text-xs text-text-muted whitespace-nowrap">
              {t(($) => $.transfer.concurrency.upload)}
            </span>
            <Select
              testId="upload-concurrency"
              ariaLabel={t(($) => $.transfer.concurrency.upload)}
              value={String(maxUploadConcurrency)}
              onChange={(value) => setMaxUploadConcurrency(Number.parseInt(value, 10))}
              options={CONCURRENCY_OPTIONS}
              className="w-20 min-h-7 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-3 justify-between">
            <span className="text-xs text-text-muted whitespace-nowrap">
              {t(($) => $.transfer.concurrency.download)}
            </span>
            <Select
              testId="download-concurrency"
              ariaLabel={t(($) => $.transfer.concurrency.download)}
              value={String(maxDownloadConcurrency)}
              onChange={(value) => setMaxDownloadConcurrency(Number.parseInt(value, 10))}
              options={CONCURRENCY_OPTIONS}
              className="w-20 min-h-7 py-1 text-xs"
            />
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
