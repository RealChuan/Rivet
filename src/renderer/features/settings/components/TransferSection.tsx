import type React from 'react'
import { useTranslation } from 'react-i18next'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import Input from '../../../components/ui/Input.js'
import Select from '../../../components/ui/Select.js'
import { useTransferStore } from '../../transfer/stores/transfer.js'

const CONCURRENCY_OPTIONS = Array.from(
  { length: TRANSFER_CONFIG.MAX_CONCURRENCY - TRANSFER_CONFIG.MIN_CONCURRENCY + 1 },
  (_, index) => {
    const value = String(index + TRANSFER_CONFIG.MIN_CONCURRENCY)
    return { label: value, value }
  },
)

/** 界面用 KB/s，设置里存字节/秒。 */
const BYTES_PER_KB = 1024

function toKbText(bytesPerSecond: number): string {
  return String(Math.round(bytesPerSecond / BYTES_PER_KB))
}

/** 空输入等价于「不限速」；非法输入返回 null，由调用方回滚到上次的有效值。 */
function parseKbText(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return TRANSFER_CONFIG.DEFAULT_SPEED_LIMIT

  const kb = Number(trimmed)
  if (!Number.isFinite(kb) || kb < 0) return null
  return Math.min(TRANSFER_CONFIG.MAX_SPEED_LIMIT, Math.round(kb * BYTES_PER_KB))
}

interface SpeedFieldProps {
  testId: string
  label: string
  value: number
  onChange: (bytesPerSecond: number) => void
}

/** 只在失焦/回车时提交：逐字符上报会把 1024 中间的 1、10、102 当成限速。 */
const SpeedField = ({ testId, label, value, onChange }: SpeedFieldProps) => {
  const commit = (input: { value: string }): void => {
    const parsed = parseKbText(input.value)
    if (parsed === null) {
      input.value = toKbText(value)
      return
    }

    input.value = toKbText(parsed)
    onChange(parsed)
  }

  return (
    <div className="relative w-24">
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        data-testid={testId}
        aria-label={label}
        defaultValue={toKbText(value)}
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget)
        }}
        className="w-full pl-3 pr-10 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">
        KB/s
      </span>
    </div>
  )
}

interface DirectionCellProps {
  caption: string
  children: React.ReactNode
}

const DirectionCell = ({ caption, children }: DirectionCellProps) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-text-muted">{caption}</span>
    {children}
  </div>
)

/** 传输分区：一行并发、一行限速，每行左右各一个方向。 */
export const TransferSection = () => {
  const { t } = useTranslation()
  const maxUploadConcurrency = useTransferStore((state) => state.maxUploadConcurrency)
  const maxDownloadConcurrency = useTransferStore((state) => state.maxDownloadConcurrency)
  const maxUploadBytesPerSecond = useTransferStore((state) => state.maxUploadBytesPerSecond)
  const maxDownloadBytesPerSecond = useTransferStore((state) => state.maxDownloadBytesPerSecond)
  const setMaxUploadConcurrency = useTransferStore((state) => state.setMaxUploadConcurrency)
  const setMaxDownloadConcurrency = useTransferStore((state) => state.setMaxDownloadConcurrency)
  const setMaxUploadBytesPerSecond = useTransferStore((state) => state.setMaxUploadBytesPerSecond)
  const setMaxDownloadBytesPerSecond = useTransferStore(
    (state) => state.setMaxDownloadBytesPerSecond,
  )

  const uploadLabel = t(($) => $.transfer.upload)
  const downloadLabel = t(($) => $.transfer.download)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <span className="text-xs text-text">
            {t(($) => $.settings.transferGroup.concurrency)}
          </span>
          <div className="flex items-center gap-3">
            <DirectionCell caption={uploadLabel}>
              <Select
                testId="upload-concurrency"
                ariaLabel={uploadLabel}
                value={String(maxUploadConcurrency)}
                onChange={(value) => setMaxUploadConcurrency(Number.parseInt(value, 10))}
                options={CONCURRENCY_OPTIONS}
                className="w-24"
              />
            </DirectionCell>
            <DirectionCell caption={downloadLabel}>
              <Select
                testId="download-concurrency"
                ariaLabel={downloadLabel}
                value={String(maxDownloadConcurrency)}
                onChange={(value) => setMaxDownloadConcurrency(Number.parseInt(value, 10))}
                options={CONCURRENCY_OPTIONS}
                className="w-24"
              />
            </DirectionCell>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <span className="text-xs text-text">{t(($) => $.settings.transferGroup.speed)}</span>
          <div className="flex items-center gap-3">
            <DirectionCell caption={uploadLabel}>
              <SpeedField
                testId="upload-speed-limit"
                label={uploadLabel}
                value={maxUploadBytesPerSecond}
                onChange={setMaxUploadBytesPerSecond}
              />
            </DirectionCell>
            <DirectionCell caption={downloadLabel}>
              <SpeedField
                testId="download-speed-limit"
                label={downloadLabel}
                value={maxDownloadBytesPerSecond}
                onChange={setMaxDownloadBytesPerSecond}
              />
            </DirectionCell>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-muted leading-relaxed">
        {t(($) => $.settings.transferNote)}
      </p>
    </div>
  )
}

export default TransferSection
