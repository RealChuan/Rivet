import { Lock } from 'lucide-react'
import { Fragment, type ChangeEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileInfo } from '@shared/types/index.js'
import { formatPermissions, parsePermissions } from '@shared/utils/index.js'
import {
  Button,
  Checkbox,
  DialogFooter,
  DialogHeader,
  GlassDialog,
  Input,
} from '../../../components/ui/index.js'

/** 界面只编辑低 9 位；setuid/setgid/sticky 不可见，保存时原样带回。 */
const SPECIAL_BITS = 0o7000
const ACCESS_BITS = 0o777
/** 协议没给 mode 时的兜底，正常不会走到 */
const DEFAULT_MODE = 0o644

const READ_BITS = [0o400, 0o040, 0o004] as const
const WRITE_BITS = [0o200, 0o020, 0o002] as const
const EXEC_BITS = [0o100, 0o010, 0o001] as const

const octalOf = (mode: number): string => (mode & ACCESS_BITS).toString(8).padStart(3, '0')

interface PermissionCellProps {
  checked: boolean
  label: string
  onToggle: (checked: boolean) => void
}

const PermissionCell = ({ checked, label, onToggle }: PermissionCellProps) => (
  <div className="flex items-center justify-center py-1.5">
    <Checkbox checked={checked} onChange={onToggle} aria-label={label} />
  </div>
)

interface PermissionsDialogContentProps {
  file: FileInfo
  onClose: () => void
  onApply: (mode: number) => void
}

const PermissionsDialogContent = ({ file, onClose, onApply }: PermissionsDialogContentProps) => {
  const { t } = useTranslation()
  const initialMode = file.mode ?? parsePermissions(file.permissions ?? '') ?? DEFAULT_MODE
  const specialBits = initialMode & SPECIAL_BITS
  const [mode, setMode] = useState(initialMode & ACCESS_BITS)
  const [octal, setOctal] = useState(octalOf(initialMode))

  const applyMode = (next: number) => {
    setMode(next)
    setOctal(octalOf(next))
  }

  const handleOctalChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-7]/g, '').slice(0, 3)
    setOctal(digits)
    if (digits.length === 3) setMode(Number.parseInt(digits, 8))
  }

  const rows = [
    { label: t(($) => $.permissions.read), bits: READ_BITS },
    { label: t(($) => $.permissions.write), bits: WRITE_BITS },
    { label: t(($) => $.permissions.execute), bits: EXEC_BITS },
  ]
  const columns = [
    t(($) => $.permissions.owner),
    t(($) => $.permissions.group),
    t(($) => $.permissions.other),
  ]

  return (
    <div className="flex flex-col">
      <DialogHeader
        icon={<Lock className="w-4.5 h-4.5 stroke-accent stroke-2" />}
        iconClassName="bg-accent/10"
        title={t(($) => $.permissions.title)}
        subtitle={file.name}
        subtitleTitle={file.absolutePath}
        onClose={onClose}
      />

      <div className="bg-surface rounded-lg p-3">
        <div className="grid grid-cols-[52px_repeat(3,1fr)] items-center gap-y-1">
          <span />
          {columns.map((label) => (
            <span key={label} className="text-2xs text-text-muted text-center">
              {label}
            </span>
          ))}
          {rows.map((row) => (
            <Fragment key={row.label}>
              <span className="text-xs text-text-secondary">{row.label}</span>
              {row.bits.map((bit, column) => (
                <PermissionCell
                  key={`${row.label}-${columns[column] ?? column}`}
                  checked={(mode & bit) !== 0}
                  label={`${columns[column] ?? ''} ${row.label}`}
                  onToggle={(checked) => applyMode(checked ? mode | bit : mode & ~bit)}
                />
              ))}
            </Fragment>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            {t(($) => $.permissions.octal)}
            <Input
              value={octal}
              onChange={handleOctalChange}
              inputMode="numeric"
              maxLength={3}
              aria-label={t(($) => $.permissions.octal)}
              className="w-14 px-2 text-center tabular-nums"
            />
          </label>
          <span className="ml-auto text-xs text-text-secondary tabular-nums">
            {formatPermissions(mode)}
          </span>
        </div>
      </div>

      <DialogFooter bordered className="mt-4">
        <Button variant="secondary" onClick={onClose}>
          {t(($) => $.common.action.cancel)}
        </Button>
        <Button
          variant="primary"
          disabled={octal.length !== 3}
          onClick={() => onApply(specialBits | mode)}
        >
          {t(($) => $.common.action.save)}
        </Button>
      </DialogFooter>
    </div>
  )
}

interface PermissionsDialogProps {
  open: boolean
  onClose: () => void
  file: FileInfo | null
  onApply: (mode: number) => void
}

export const PermissionsDialog = ({ open, onClose, file, onApply }: PermissionsDialogProps) => {
  if (!file) return null

  return (
    <GlassDialog open={open} onClose={onClose} width={460}>
      <PermissionsDialogContent
        key={file.absolutePath}
        file={file}
        onClose={onClose}
        onApply={onApply}
      />
    </GlassDialog>
  )
}

export default PermissionsDialog
