import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  className?: string
  iconClassName?: string
  tone?: 'navy' | 'orange' | 'zinc' | 'emerald' | 'soft' | 'white' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const toneMap = {
  navy: 'bg-liqui-navy text-white',
  orange: 'bg-liqui-orange text-white',
  zinc: 'bg-zinc-100 text-zinc-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  soft: 'bg-liqui-orange-soft text-liqui-orange',
  white: 'bg-white text-liqui-navy shadow-sm',
  danger: 'bg-red-100 text-red-600',
}

const sizeMap = {
  sm: { box: 'h-6 w-6 rounded-lg', icon: 'h-3 w-3' },
  md: { box: 'h-7 w-7 rounded-xl', icon: 'h-3.5 w-3.5' },
  lg: { box: 'h-9 w-9 rounded-xl', icon: 'h-4 w-4' },
}

/** Ícone sempre dentro de um quadrado com border-radius. */
export function IconBubble({
  icon: Icon,
  className = '',
  iconClassName = '',
  tone = 'zinc',
  size = 'md',
}: Props) {
  const s = sizeMap[size]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${s.box} ${toneMap[tone]} ${className}`}
    >
      <Icon className={`${s.icon} ${iconClassName}`} />
    </span>
  )
}
