import { Separator } from 'react-resizable-panels'

export const ResizeSeparator = () => (
  <Separator className="group relative flex items-center justify-center h-full w-1.25">
    <div className="h-full w-px transition-colors duration-150 bg-border group-data-[separator=hover]:bg-accent/30 group-data-[separator=active]:bg-accent/30" />
    <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-5 rounded-full bg-accent transition-all duration-150 opacity-0 group-data-[separator=hover]:opacity-100 group-data-[separator=active]:opacity-100" />
  </Separator>
)
