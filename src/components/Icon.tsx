const PATHS = {
  today: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  program: 'M4 5h16M4 5v15h16V5M8 3v4M16 3v4M4 10h16M9 14h2M13 14h2M9 17h2',
  progress: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  body: 'M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10h12M12 10v5M12 15l-3 7M12 15l3 7',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17 19 7',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z',
  pause: 'M9 5v14M15 5v14',
  food: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2.5 1-4 4-4 8h4',
  photo: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
  cart: 'M3 4h2l2.5 11h10L20 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM5 17a3 3 0 0 1 3-3h11M9 8h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M21 21v-1a6 6 0 0 0-4-5.7',
  hand: 'M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 10.5V4.5a1.5 1.5 0 0 1 3 0V11M13 10.5V5.5a1.5 1.5 0 0 1 3 0V11.5M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5.2-3L4.2 14a1.5 1.5 0 0 1 2.5-1.6L8 14',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21h4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
