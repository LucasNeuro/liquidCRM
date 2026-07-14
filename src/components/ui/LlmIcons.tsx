type SvgProps = {
  className?: string
  title?: string
}

/** Marca Google Gemini (sparkle oficial simplificado, com gradiente). */
export function GeminiIcon({ className = 'h-5 w-5', title }: SvgProps) {
  const gid = 'liqui-gemini-grad'
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title || 'Google Gemini'}
    >
      <title>{title || 'Google Gemini'}</title>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B72CB" />
          <stop offset="68%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#D68136" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M12 2c0 5.523 4.477 10 10 10-5.523 0-10 4.477-10 10 0-5.523-4.477-10-10-10 5.523 0 10-4.477 10-10z"
      />
    </svg>
  )
}

/**
 * Emblema oficial Mistral AI (pixel / “M” em barras).
 * Cores do brand kit: gold → #ffaf00 → #ff8205 → #fa500f → #e10500.
 */
export function MistralIcon({ className = 'h-5 w-5', title }: SvgProps) {
  return (
    <svg
      viewBox="90.909 90.909 212.122 151.515"
      className={className}
      role="img"
      aria-label={title || 'Mistral AI'}
    >
      <title>{title || 'Mistral AI'}</title>
      <path
        fill="#FFD700"
        d="M121.21 90.909h30.303v30.303H121.21zm121.21 0h30.303v30.303H242.42z"
      />
      <path
        fill="#FFAF00"
        d="M121.21 121.21h60.606v30.303H121.21zm90.91 0h60.606v30.303H212.12z"
      />
      <path fill="#FF8205" d="M121.21 151.52h151.52v30.303H121.21z" />
      <path
        fill="#FA500F"
        d="M121.21 181.82h30.303v30.303H121.21zm60.61 0h30.303v30.303H181.82zm60.6 0h30.303v30.303H242.42z"
      />
      <path
        fill="#E10500"
        d="M90.909 212.12h90.909v30.303H90.909zm121.211 0h90.909v30.303H212.12z"
      />
    </svg>
  )
}

/** Bolha com SVG de LLM (mesmo formato do IconBubble). */
export function LlmIconBubble({
  provider,
  size = 'lg',
}: {
  provider: 'gemini' | 'mistral'
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'sm'
      ? 'h-6 w-6 rounded-lg'
      : size === 'md'
        ? 'h-7 w-7 rounded-xl'
        : 'h-9 w-9 rounded-xl'
  const icon =
    size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-zinc-50 ring-1 ring-zinc-200/80 ${box}`}
    >
      {provider === 'gemini' ? (
        <GeminiIcon className={icon} />
      ) : (
        <MistralIcon className={icon} />
      )}
    </span>
  )
}
