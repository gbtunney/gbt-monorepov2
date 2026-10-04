import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boxes, ClipboardCheck, ClipboardList, Network, Package, PackagePlus, Settings } from 'lucide-react'
import { cn } from '../../lib/shadcn/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Equipment', icon: Package },
  { to: '/intake', label: 'Legacy Intake', icon: PackagePlus },
  { to: '/needs-checking', label: 'Needs Checking', icon: ClipboardCheck },
  { to: '/bins', label: 'Bins', icon: Boxes },
  { to: '/ha', label: 'HA Discovery', icon: Network },
  { to: '/audit', label: 'Audit Inbox', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Boxes className="h-5 w-5 text-primary" />
            <span>Home Inventory</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
