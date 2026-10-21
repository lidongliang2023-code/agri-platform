import { useId } from 'react'

interface BrandMarkProps {
  size?: number
  className?: string
}

/** 丰链云品牌图形：双叶生长 + 产业链节点。 */
export function BrandMark({ size = 36, className }: BrandMarkProps): JSX.Element {
  const id = useId().replace(/:/g, '')
  const bg = `${id}-brand-bg`
  const gold = `${id}-brand-gold`
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512"
      role="img" aria-label="丰链云">
      <defs>
        <linearGradient id={bg} x1="72" y1="52" x2="438" y2="462" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B4A35" /><stop offset=".58" stopColor="#087A50" />
          <stop offset="1" stopColor="#16B978" />
        </linearGradient>
        <linearGradient id={gold} x1="210" y1="354" x2="322" y2="434" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE08A" /><stop offset="1" stopColor="#F4B93D" />
        </linearGradient>
      </defs>
      <rect x="28" y="28" width="456" height="456" rx="126" fill={`url(#${bg})`} />
      <path d="M104 365C171 325 197 274 213 219" fill="none" stroke="#A7F3D0"
        strokeWidth="18" strokeLinecap="round" opacity=".2" />
      <path d="M408 365C341 325 315 274 299 219" fill="none" stroke="#BAE6FD"
        strokeWidth="18" strokeLinecap="round" opacity=".18" />
      <g fill="#fff">
        <path d="M254 337V196" fill="none" stroke="#fff" strokeWidth="28" strokeLinecap="round" />
        <path d="M250 274C207 278 173 250 164 202C211 198 244 226 250 274Z" />
        <path d="M262 231C268 182 302 155 351 160C347 209 313 237 262 231Z" />
      </g>
      <path d="M151 360C190 403 222 420 256 420C290 420 322 403 361 360" fill="none"
        stroke="#fff" strokeWidth="24" strokeLinecap="round" />
      <path d="M151 360C190 403 222 420 256 420C290 420 322 403 361 360" fill="none"
        stroke={`url(#${gold})`} strokeWidth="10" strokeLinecap="round" />
      <g fill={`url(#${gold})`}>
        <circle cx="151" cy="360" r="22" /><circle cx="256" cy="420" r="26" />
        <circle cx="361" cy="360" r="22" />
      </g>
      <g fill="#fff" opacity=".9">
        <circle cx="151" cy="360" r="7" /><circle cx="256" cy="420" r="8" />
        <circle cx="361" cy="360" r="7" />
      </g>
    </svg>
  )
}
