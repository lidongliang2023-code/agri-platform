/** 统一认证中心线性图标集（与设计稿一致，仅描边不使用填充）。 */
export function Icon({ name, size = 16 }: { name: string; size?: number }): JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></svg>
    case 'seed':
      return <svg {...common}><path d="M12 21c0-6 3-9 8-9 0 6-3 9-8 9Z" /><path d="M12 21c0-6-3-9-8-9 0 6 3 9 8 9Z" /><path d="M12 21v-8" /></svg>
    case 'shield':
      return <svg {...common}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
    case 'zap':
      return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
    case 'money':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9 9h6M9 15h6M12 7v10" /></svg>
    case 'cart':
      return <svg {...common}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2l2.2 10.2A2 2 0 0 0 9.2 16H18l2-8H6" /></svg>
    case 'box':
      return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>
    case 'factory':
      return <svg {...common}><path d="M3 21V10l5 3V10l5 3V7l8 5v9H3Z" /><path d="M7 17h2M12 17h2M17 17h2" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
    case 'check':
      return <svg {...common}><path d="m5 12 5 5 9-10" /></svg>
    case 'eye':
      return <svg {...common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>
    case 'eye-off':
      return <svg {...common}><path d="m3 3 18 18" /><path d="M10.6 6.2A11 11 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.2 6.5C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.6-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
  }
}
