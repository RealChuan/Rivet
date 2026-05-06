import { Loader } from 'lucide-react'

interface LoaderIconProps {
  className?: string
}

export const LoaderIcon = ({ className = 'w-3.5 h-3.5' }: LoaderIconProps) => (
  <Loader className={`${className} animate-spin`} aria-hidden="true" />
)
