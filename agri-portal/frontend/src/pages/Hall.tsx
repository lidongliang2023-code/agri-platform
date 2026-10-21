import { useEffect, useState } from 'react'
import { tradeUrl } from '../utils'
import './hall-embed.css'

export function Hall(): JSX.Element {
  const [height, setHeight] = useState(1800)

  useEffect(() => {
    const hallOrigin = new URL(tradeUrl('/')).origin
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== hallOrigin) return
      const data = event.data as { type?: string; height?: number } | null
      if (data?.type !== 'agri-hall-height' || typeof data.height !== 'number') return
      setHeight(Math.max(900, Math.ceil(data.height)))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <section className="portal-hall-embed">
      <iframe
        src={tradeUrl('/hall?embed=1')}
        title="丰链云交易大厅"
        style={{ height }}
        scrolling="no"
        onLoad={(event) => {
          event.currentTarget.contentWindow?.postMessage({ type: 'agri-hall-ready' }, '*')
        }}
      />
    </section>
  )
}
