import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title: string
  icon?: LucideIcon
  children: ReactNode
  headerExtra?: ReactNode
  headerRight?: ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  icon: Icon,
  children,
  headerExtra,
  headerRight,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn('border-border bg-card/50', className)}>
      <CardHeader className="py-3 px-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground uppercase tracking-wider">
              {title}
            </CardTitle>
            {headerExtra}
          </div>
          {headerRight}
        </div>
      </CardHeader>
      <CardContent className={cn('p-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
