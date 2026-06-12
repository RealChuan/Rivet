import { File, Folder } from 'lucide-react'
import { type FileType, FILE_TYPE } from '@shared/constants/index.js'

interface FileIconProps {
  type: FileType
  className?: string
}

export const FileIcon = ({ type, className = '' }: FileIconProps) => {
  if (type === FILE_TYPE.DIRECTORY) {
    return (
      <Folder
        className={`w-4 h-4 ${className}`}
        fill="var(--color-warning)"
        stroke="none"
        aria-hidden="true"
      />
    )
  }

  return (
    <File
      className={`w-4 h-4 ${className}`}
      fill="var(--color-accent-light)"
      stroke="var(--color-accent)"
      strokeWidth={1.5}
      aria-hidden="true"
    />
  )
}
