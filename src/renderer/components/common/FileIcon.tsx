import {
  Braces,
  Database,
  File,
  FileArchive,
  FileBox,
  FileCode,
  FileImage,
  FileKey,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileType as FileTypeIcon,
  FileVideoCamera,
  Folder,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import { type FileType, FILE_TYPE } from '@shared/constants/index.js'
import { cn } from '../../utils/index.js'

interface FileIconProps {
  type: FileType
  /** 文件名，用于按后缀挑选图标；目录或不传时使用默认图标 */
  name?: string
  className?: string
}

/** 除目录与通用文件外的图标分类 */
type FileKind =
  | 'archive'
  | 'audio'
  | 'code'
  | 'data'
  | 'database'
  | 'document'
  | 'executable'
  | 'font'
  | 'image'
  | 'key'
  | 'pdf'
  | 'presentation'
  | 'spreadsheet'
  | 'video'

type IconSpec = {
  Icon: LucideIcon
  stroke: string
}

const ICON_SPEC: Record<FileKind | 'file', IconSpec> = {
  archive: { Icon: FileArchive, stroke: 'var(--color-text-muted)' },
  audio: { Icon: FileMusic, stroke: 'var(--color-status-disconnected)' },
  code: { Icon: FileCode, stroke: 'var(--color-protocol-webdav)' },
  data: { Icon: Braces, stroke: 'var(--color-warning)' },
  database: { Icon: Database, stroke: 'var(--color-protocol-webdav)' },
  document: { Icon: FileText, stroke: 'var(--color-accent)' },
  executable: { Icon: FileBox, stroke: 'var(--color-text-muted)' },
  file: { Icon: File, stroke: 'var(--color-accent)' },
  font: { Icon: FileTypeIcon, stroke: 'var(--color-text-muted)' },
  image: { Icon: FileImage, stroke: 'var(--color-status-connected)' },
  key: { Icon: FileKey, stroke: 'var(--color-danger)' },
  pdf: { Icon: FileText, stroke: 'var(--color-danger)' },
  presentation: { Icon: Presentation, stroke: 'var(--color-warning)' },
  spreadsheet: { Icon: FileSpreadsheet, stroke: 'var(--color-status-connected)' },
  video: { Icon: FileVideoCamera, stroke: 'var(--color-protocol-webdav)' },
}

/** 后缀 → 分类；未命中的后缀回退到通用文件图标 */
const EXTENSION_KIND: Record<string, FileKind> = {
  // 文档
  doc: 'document',
  docx: 'document',
  log: 'document',
  markdown: 'document',
  md: 'document',
  odt: 'document',
  rtf: 'document',
  txt: 'document',
  pdf: 'pdf',
  // 表格
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  tsv: 'spreadsheet',
  xls: 'spreadsheet',
  xlsm: 'spreadsheet',
  xlsx: 'spreadsheet',
  // 演示
  key: 'presentation',
  odp: 'presentation',
  ppt: 'presentation',
  pptx: 'presentation',
  // 代码
  bash: 'code',
  bat: 'code',
  c: 'code',
  cc: 'code',
  cjs: 'code',
  cpp: 'code',
  cs: 'code',
  css: 'code',
  dart: 'code',
  go: 'code',
  h: 'code',
  hpp: 'code',
  htm: 'code',
  html: 'code',
  java: 'code',
  js: 'code',
  jsx: 'code',
  kt: 'code',
  less: 'code',
  lua: 'code',
  mjs: 'code',
  php: 'code',
  ps1: 'code',
  py: 'code',
  rb: 'code',
  rs: 'code',
  scala: 'code',
  scss: 'code',
  sh: 'code',
  sql: 'code',
  svelte: 'code',
  swift: 'code',
  ts: 'code',
  tsx: 'code',
  vue: 'code',
  zsh: 'code',
  // 数据与配置
  cfg: 'data',
  conf: 'data',
  env: 'data',
  ini: 'data',
  json: 'data',
  jsonc: 'data',
  toml: 'data',
  xml: 'data',
  yaml: 'data',
  yml: 'data',
  // 图片
  ai: 'image',
  avif: 'image',
  bmp: 'image',
  gif: 'image',
  heic: 'image',
  ico: 'image',
  jpeg: 'image',
  jpg: 'image',
  png: 'image',
  psd: 'image',
  svg: 'image',
  tif: 'image',
  tiff: 'image',
  webp: 'image',
  // 视频
  avi: 'video',
  flv: 'video',
  m4v: 'video',
  mkv: 'video',
  mov: 'video',
  mp4: 'video',
  mpeg: 'video',
  mpg: 'video',
  webm: 'video',
  wmv: 'video',
  // 音频
  aac: 'audio',
  flac: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  opus: 'audio',
  wav: 'audio',
  wma: 'audio',
  // 压缩包
  '7z': 'archive',
  bz2: 'archive',
  cab: 'archive',
  gz: 'archive',
  rar: 'archive',
  tar: 'archive',
  tgz: 'archive',
  xz: 'archive',
  zip: 'archive',
  zst: 'archive',
  // 安装包与镜像
  apk: 'executable',
  appimage: 'executable',
  deb: 'executable',
  dmg: 'executable',
  exe: 'executable',
  iso: 'executable',
  msi: 'executable',
  pkg: 'executable',
  rpm: 'executable',
  // 密钥与证书
  cer: 'key',
  crt: 'key',
  p12: 'key',
  pem: 'key',
  pfx: 'key',
  pub: 'key',
  // 数据库
  db: 'database',
  mdb: 'database',
  sqlite: 'database',
  sqlite3: 'database',
  // 字体
  eot: 'font',
  otf: 'font',
  ttf: 'font',
  woff: 'font',
  woff2: 'font',
}

/** 无后缀的约定文件名 */
const NAME_KIND: Record<string, FileKind> = {
  '.editorconfig': 'data',
  '.env': 'data',
  '.gitignore': 'data',
  '.gitattributes': 'data',
  '.npmrc': 'data',
  '.prettierrc': 'data',
  changelog: 'document',
  dockerfile: 'code',
  license: 'document',
  makefile: 'code',
  readme: 'document',
}

export function resolveFileKind(name: string): FileKind | 'file' {
  const normalized = name.toLowerCase()
  const nameKind = NAME_KIND[normalized]
  if (nameKind) return nameKind

  const dot = normalized.lastIndexOf('.')
  if (dot <= 0) return 'file'

  return EXTENSION_KIND[normalized.slice(dot + 1)] ?? 'file'
}

export const FileIcon = ({ type, name = '', className = '' }: FileIconProps) => {
  if (type === FILE_TYPE.DIRECTORY) {
    return (
      <Folder
        className={cn('w-4 h-4', className)}
        fill="var(--color-warning)"
        stroke="none"
        aria-hidden="true"
      />
    )
  }

  const { Icon, stroke } = ICON_SPEC[resolveFileKind(name)]

  return (
    <Icon
      className={cn('w-4 h-4', className)}
      stroke={stroke}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  )
}
