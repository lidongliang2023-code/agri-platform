interface IconProps {
  size?: number
}

/** 微信扫码登录标识。 */
export function WechatIcon({ size = 28 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#07C160"
        d="M20 7C10.6 7 3 13.3 3 21.1c0 4.4 2.4 8.3 6.3 10.9l-1.7 5.9 6.8-3.4c1.8.5 3.7.8 5.6.8.6 0 1.3 0 1.9-.1a10 10 0 0 1-.6-3.4c0-6.5 6.1-11.7 13.7-11.7.9 0 1.8.1 2.7.2C35.9 11.9 28.8 7 20 7Z"
      />
      <circle cx="14" cy="17" r="2.2" fill="#fff" />
      <circle cx="25" cy="17" r="2.2" fill="#fff" />
      <path
        fill="#07C160"
        d="M44.8 32.5c0-5.4-4.9-9.7-10.9-9.7s-10.9 4.3-10.9 9.7 4.9 9.7 10.9 9.7c1.4 0 2.7-.2 3.9-.6l4.9 2.3-1.2-4.2c2.1-1.8 3.3-4.3 3.3-7.2Z"
      />
      <circle cx="30" cy="30.5" r="1.7" fill="#fff" />
      <circle cx="38" cy="30.5" r="1.7" fill="#fff" />
    </svg>
  )
}

/** 支付宝扫码登录标识。 */
export function AlipayIcon({ size = 28 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#1677FF" />
      <text
        x="24"
        y="25"
        fill="#fff"
        fontFamily="'Microsoft YaHei', 'PingFang SC', sans-serif"
        fontSize="27"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
      >支</text>
    </svg>
  )
}

/** 国家政务服务平台登录标识。 */
export function GovernmentServiceIcon({ size = 28 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#C8352A" />
      <path
        fill="#FFD66B"
        d="m24 7.5 1.45 3.2 3.5.36-2.63 2.35.74 3.44L24 15.12l-3.06 1.73.74-3.44-2.63-2.35 3.5-.36L24 7.5Z"
      />
      <g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 22 24 14l14 8M13 22v14M19 22v14M25 22v14M31 22v14M35 22v14M9 36h30M7 40h34" />
      </g>
    </svg>
  )
}
