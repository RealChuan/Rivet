import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DIALOG_SIZE, TOAST_TYPE } from '@shared/constants/index.js'
import Button from '../../../components/ui/Button.js'
import GlassDialog from '../../../components/ui/GlassDialog.js'
import { DialogCloseButton, DialogFooter } from '../../../components/ui/index.js'
import { useUiStore } from '../../../stores/index.js'

/** 剪贴板复制按钮反馈显示时长 */
const COPY_FEEDBACK_DURATION = 2000

interface ErrorDetailDialogProps {
  open: boolean
  onClose: () => void
  errorMessage: string
}

export const ErrorDetailDialog = ({ open, onClose, errorMessage }: ErrorDetailDialogProps) => {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = () => {
    void navigator.clipboard.writeText(errorMessage).then(() => {
      setCopied(true)
      addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.transfer.errorDetail.copied) })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION)
    })
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      width={DIALOG_SIZE.MEDIUM.width}
      height={DIALOG_SIZE.MEDIUM.height}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">
            {t(($) => $.transfer.errorDetail.title)}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg bg-hover p-3 mb-4">
          <pre className="text-sm text-text font-mono whitespace-pre-wrap break-all m-0">
            {errorMessage}
          </pre>
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={handleCopy}>
            {copied
              ? t(($) => $.transfer.errorDetail.copied)
              : t(($) => $.transfer.errorDetail.copy)}
          </Button>
        </DialogFooter>
      </div>
    </GlassDialog>
  )
}
