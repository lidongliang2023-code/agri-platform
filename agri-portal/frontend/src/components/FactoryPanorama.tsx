import { useEffect, useRef, useState } from 'react'

/** 等距柱状 2:1 全景图的球面投影；拖拽旋转，滚轮缩放。 */
export function FactoryPanorama({ url }: { url: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) { setError('当前设备不支持全景渲染，请查看其他实景素材。'); return }
    let disposed = false, yaw = 0, pitch = 0, fov = 1.3, drag = false, x = 0, y = 0
    const shader = (type: number, code: string): WebGLShader => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, code); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('全景渲染初始化失败')
      return s
    }
    let program: WebGLProgram, vertex: WebGLShader, fragment: WebGLShader
    try {
      vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){uv=p;gl_Position=vec4(p,0.,1.);}')
      fragment = shader(gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float yaw,pitch,fov,aspect;
      void main(){vec3 r=normalize(vec3(uv.x*aspect*fov,uv.y*fov,-1.)); float c=cos(pitch),s=sin(pitch);r=vec3(r.x,r.y*c-r.z*s,r.y*s+r.z*c);c=cos(yaw);s=sin(yaw);r=vec3(r.x*c+r.z*s,r.y,-r.x*s+r.z*c);vec2 t=vec2(atan(r.x,-r.z)/6.2831853+.5, .5-asin(clamp(r.y,-1.,1.))/3.14159265);gl_FragColor=texture2D(tex,t);}`)
      program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('全景渲染初始化失败')
    } catch { setError('全景渲染初始化失败，请查看其他素材。'); return }
    gl.useProgram(program)
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture)
    const render = (): void => {
      if (disposed) return
      canvas.width = Math.max(1, canvas.clientWidth * Math.min(devicePixelRatio, 2)); canvas.height = Math.max(1, canvas.clientHeight * Math.min(devicePixelRatio, 2))
      gl.viewport(0, 0, canvas.width, canvas.height)
      for (const [key, value] of Object.entries({ yaw, pitch, fov, aspect: canvas.width / canvas.height })) gl.uniform1f(gl.getUniformLocation(program, key), value)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    const image = new Image(); image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (disposed) return
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); render()
      } catch { setError('全景素材加载失败，请检查资源权限及跨域配置。') }
    }
    image.onerror = () => { if (!disposed) setError('全景素材不可用，请联系运营核验地址与跨域配置。') }; image.src = url
    const down = (e: PointerEvent): void => { drag = true; x = e.clientX; y = e.clientY; canvas.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent): void => { if (!drag) return; yaw -= (e.clientX-x)*.006; pitch = Math.max(-1.45, Math.min(1.45, pitch+(e.clientY-y)*.006)); x=e.clientX; y=e.clientY; render() }
    const up = (): void => { drag = false }
    const wheel = (e: WheelEvent): void => { e.preventDefault(); fov=Math.max(.35,Math.min(2,fov+e.deltaY*.001));render() }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false})
    const resize = new ResizeObserver(render); resize.observe(canvas)
    return () => { disposed=true;image.onload=null;image.onerror=null;resize.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment) }
  }, [url])
  return <div className="factory-panorama"><canvas ref={ref} aria-label="360度基地全景，拖动旋转、滚轮缩放" />{error ? <p role="alert">{error}</p> : <span>360° 全景 · 拖动环视 · 滚轮缩放</span>}</div>
}
