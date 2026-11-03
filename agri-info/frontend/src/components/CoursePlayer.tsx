import { useEffect, useRef } from 'react'

/**
 * 课程播放器。
 *
 * <p>为什么不直接用 UI 库的播放器组件：三端（PC / 小程序 / App）里只有 PC 能用 DOM 播放器，
 * 为了视觉与行为在三端尽量一致，这里只封装原生 {@code <video>} + hls.js，
 * 控制条沿用浏览器原生样式，避免"PC 是自定义皮肤、手机是原生控件"的割裂感。</p>
 *
 * <p>hls.js 走动态 import：只有真的播放 m3u8 时才加载（约 400KB），
 * 不影响首屏；mp4 场景完全不会请求它。</p>
 */

/** 进度上报节流间隔。太频繁会把日志表写爆，太稀疏会丢学习时长。 */
const REPORT_INTERVAL_MS = 15000

interface CoursePlayerProps {
  /** 签名播放地址（相对路径，浏览器自动拼 origin）。 */
  src: string
  poster?: string
  /** 续播起点（秒）。 */
  initialTime?: number
  onProgress?: (positionSec: number) => void
  onEnded?: () => void
  /** 地址过期或拉流失败。父组件负责重新换票，播放器本身不重试，避免打转。 */
  onFailed?: () => void
}

export function CoursePlayer({
  src,
  poster,
  initialTime = 0,
  onProgress,
  onEnded,
  onFailed,
}: CoursePlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)
  // 回调放进 ref：父组件每次渲染都会传新函数，直接进依赖会让播放器反复重建、播放中断。
  const progressRef = useRef(onProgress)
  const endedRef = useRef(onEnded)
  const failedRef = useRef(onFailed)
  progressRef.current = onProgress
  endedRef.current = onEnded
  failedRef.current = onFailed

  useEffect(() => {
    const element = videoRef.current
    if (!element || !src) return undefined

    let timer: number | undefined
    const flush = (): void => {
      progressRef.current?.(Math.floor(element.currentTime))
    }
    const startTimer = (): void => {
      if (timer) window.clearInterval(timer)
      timer = window.setInterval(flush, REPORT_INTERVAL_MS)
    }
    const stopTimer = (): void => {
      if (timer) {
        window.clearInterval(timer)
        timer = undefined
      }
      flush()
    }

    const handlePlay = (): void => startTimer()
    const handlePause = (): void => stopTimer()
    const handleEnded = (): void => {
      stopTimer()
      endedRef.current?.()
    }
    // 视频元素拿不到 HTTP 状态码，410（签名过期）与网络错误都会落到这里。
    // 统一交给父组件换票重试一次即可，播放器不自己重试。
    const handleError = (): void => failedRef.current?.()

    element.addEventListener('play', handlePlay)
    element.addEventListener('pause', handlePause)
    element.addEventListener('ended', handleEnded)
    element.addEventListener('error', handleError)

    let cancelled = false
    const isHls = src.includes('.m3u8')
    // Safari / iOS 原生支持 HLS，不需要 hls.js；其余浏览器才按需加载
    if (isHls && !element.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || !Hls.isSupported()) return
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
          hls.loadSource(src)
          hls.attachMedia(element)
          hlsRef.current = hls
        })
        .catch(() => failedRef.current?.())
    }

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      element.removeEventListener('play', handlePlay)
      element.removeEventListener('pause', handlePause)
      element.removeEventListener('ended', handleEnded)
      element.removeEventListener('error', handleError)
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        // 续播：只跳一次，避免用户手动拖回开头后被再次拽走
        if (initialTime > 1 && Math.abs(event.currentTarget.currentTime - initialTime) > 2) {
          event.currentTarget.currentTime = initialTime
        }
      }}
      style={{ width: '100%', display: 'block', borderRadius: 12, background: '#0b1a12' }}
    />
  )
}
