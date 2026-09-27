import { useSyncStatus } from '../../partner/useSync'

/** "Synced", "Syncing…" or "Offline, will sync". */
export function SyncBadge() {
  const state = useSyncStatus((s) => s.state)
  const [text, tone] =
    state === 'synced'
      ? ['Synced', 'text-good']
      : state === 'syncing'
        ? ['Syncing…', 'text-muted']
        : state === 'offline' || state === 'pending'
          ? ['Offline · will sync', 'text-warn']
          : state === 'error'
            ? ['Sync problem · will retry', 'text-warn']
            : ['Not synced yet', 'text-muted']
  return (
    <span role="status" className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {text}
    </span>
  )
}
