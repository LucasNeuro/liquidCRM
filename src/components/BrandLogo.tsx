/** Logo no Storage Supabase */
export const LIQUI_LOGO_URL =
  'https://nnhiyqtzzjfxnxgmufgo.supabase.co/storage/v1/object/public/logo/Gemini_Generated_Image_9f15rw9f15rw9f15.png'

type BrandLogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** Cantos uniformes. Default 15px. */
  rounded?: number | string
  /** Centraliza a imagem no espaço disponível */
  centered?: boolean
}

const sizes = {
  sm: 'h-11 w-auto max-w-[160px]',
  md: 'h-14 w-auto max-w-[190px]',
  lg: 'h-16 w-auto max-w-[210px]',
}

/** Logo LIQUI — menor, border-radius 15px em todos os cantos */
export function BrandLogo({
  className = '',
  size = 'md',
  rounded = 15,
  centered = false,
}: BrandLogoProps) {
  const radius = typeof rounded === 'number' ? `${rounded}px` : rounded
  return (
    <img
      src={LIQUI_LOGO_URL}
      alt="LIQUI"
      className={[
        'block object-contain',
        centered ? 'mx-auto object-center' : 'object-center',
        sizes[size],
        className,
      ].join(' ')}
      style={{
        borderRadius: radius,
      }}
    />
  )
}

export { LIQUI_LOGO_URL as LIQUI_MARK_URL }
