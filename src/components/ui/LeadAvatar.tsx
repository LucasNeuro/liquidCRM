const PALETTE = [
  '#0A1B39',
  '#F7941D',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#ca8a04',
]

function hashName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return h
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function avatarColor(name: string) {
  return PALETTE[hashName(name) % PALETTE.length]
}

/** URL de avatar ilustrado estável (DiceBear) — sem upload. */
export function avatarUrl(name: string, size = 80) {
  const seed = encodeURIComponent(name.trim() || 'lead')
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&size=${size}&backgroundColor=f3f4f6`
}

type LeadAvatarProps = {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
}

export function LeadAvatar({ name, size = 'md', className = '' }: LeadAvatarProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-white ${sizeMap[size]} ${className}`}
      title={name}
    >
      <img
        src={avatarUrl(name, size === 'lg' ? 112 : size === 'md' ? 80 : 64)}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget
          el.style.display = 'none'
          const fallback = el.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <span
        className="hidden h-full w-full items-center justify-center font-bold text-white"
        style={{ backgroundColor: avatarColor(name) }}
      >
        {getInitials(name)}
      </span>
    </span>
  )
}
