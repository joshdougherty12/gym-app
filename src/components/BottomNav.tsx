import { NavLink } from 'react-router'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/program', label: 'Program', icon: 'program' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/body', label: 'Body', icon: 'body' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide uppercase ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon name={t.icon} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
