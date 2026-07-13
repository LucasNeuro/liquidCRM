/** Logo no Storage Supabase */
export const LIQUI_LOGO_URL =
  'https://nnhiyqtzzjfxnxgmufgo.supabase.co/storage/v1/object/public/logo/Gemini_Generated_Image_9f15rw9f15rw9f15.png'

type BrandLogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'h-16 w-auto',
  md: 'h-[4.5rem] w-auto',
  lg: 'h-24 w-full max-w-[220px]',
}

/** Logo em destaque — só a imagem, border-radius 20px à esquerda (marca LIQUI) */
export function BrandLogo({ className = '', size = 'lg' }: BrandLogoProps) {
  return (
    <img
      src={LIQUI_LOGO_URL}
      alt="LIQUI"
      className={`block object-contain object-left ${sizes[size]} ${className}`}
      style={{
        borderRadius: '20px 0 0 20px',
      }}
    />
  )
}

export { LIQUI_LOGO_URL as LIQUI_MARK_URL }
