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

/** 上传/下载并发槽数量。全局设置，设置弹窗内使用。 */
export const ConcurrencyFields = () => {
  const { t } = useTranslation()
  const maxUploadConcurrency = useTransferStore((state) => state.maxUploadConcurrency)
  const maxDownloadConcurrency = useTransferStore((state) => state.maxDownloadConcurrency)
  const setMaxUploadConcurrency = useTransferStore((state) => state.setMaxUploadConcurrency)
  const setMaxDownloadConcurrency = useTransferStore((state) => state.setMaxDownloadConcurrency)

  return (
    <div>
      <p className="text-xs text-text-muted leading-relaxed">
        {t(($) => $.settings.concurrencyHint)}
      </p>
      <div className="mt-3 flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-text">{t(($) => $.transfer.concurrency.upload)}</span>
          <Select
            testId="upload-concurrency"
            ariaLabel={t(($) => $.transfer.concurrency.upload)}
            value={String(maxUploadConcurrency)}
            onChange={(value) => setMaxUploadConcurrency(Number.parseInt(value, 10))}
            options={CONCURRENCY_OPTIONS}
            className="w-20 min-h-8 py-1 text-xs"
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-text">{t(($) => $.transfer.concurrency.download)}</span>
          <Select
            testId="download-concurrency"
            ariaLabel={t(($) => $.transfer.concurrency.download)}
            value={String(maxDownloadConcurrency)}
            onChange={(value) => setMaxDownloadConcurrency(Number.parseInt(value, 10))}
            options={CONCURRENCY_OPTIONS}
            className="w-20 min-h-8 py-1 text-xs"
          />
        </div>
      </div>
    </div>
  )
}

export default ConcurrencyFields
