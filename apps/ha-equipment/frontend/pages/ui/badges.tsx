import { Badge } from '../../lib/shadcn/badge'
import { cn } from '../../lib/shadcn/utils'
import { severityStyle, stageClass } from '../../utils/inventory'

export function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyle(severity)
  return (
    <Badge variant="outline" className={cn('font-medium', style.className)}>
      {style.label}
    </Badge>
  )
}

export function StageBadge({ code, name }: { code: string | null | undefined; name: string | null | undefined }) {
  return (
    <Badge variant="outline" className={cn('font-medium', stageClass(code ?? ''))}>
      {name ?? code ?? '—'}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900',
    acknowledged: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900',
    snoozed: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-900',
    resolved: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900',
    ignored: 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  }
  return (
    <Badge variant="outline" className={cn('font-medium capitalize', map[status] ?? 'bg-secondary text-secondary-foreground')}>
      {status}
    </Badge>
  )
}
