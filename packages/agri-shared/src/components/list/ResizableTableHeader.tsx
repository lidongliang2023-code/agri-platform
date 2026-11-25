import { useRef, useState } from 'react'
import type { ThHTMLAttributes, PointerEvent } from 'react'
import { MIN_RESIZABLE_COLUMN_WIDTH, clampColumnWidth } from './listColumnUtils'

export interface ResizableTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  resizeWidth?: number
  onColumnResize?: (width: number) => void
  onColumnReset?: () => void
  minWidth?: number
}

/** 共用列宽手柄：保留原表头排序、筛选事件，拖动不触发排序，双击恢复该列默认宽度。 */
export default function ResizableTableHeader({
  resizeWidth,
  onColumnResize,
  onColumnReset,
  minWidth = MIN_RESIZABLE_COLUMN_WIDTH,
  children,
  ...props
}: ResizableTableHeaderProps): JSX.Element {
  const drag = useRef<{ x: number; width: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const stop = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    drag.current = null
    setDragging(false)
  }
  return (
    <th {...props}>
      {children}
      {resizeWidth !== undefined && onColumnResize && (
        <span
          className={`agri-column-resize-handle production-column-resize-handle${dragging ? ' is-dragging' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整列宽"
          aria-valuenow={Math.round(resizeWidth)}
          aria-valuemin={minWidth}
          tabIndex={0}
          title={onColumnReset ? '拖动调整列宽，双击恢复默认宽度' : '拖动调整列宽'}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onColumnReset?.()
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.stopPropagation()
            drag.current = {
              x: event.clientX,
              width: event.currentTarget.parentElement?.getBoundingClientRect().width ?? resizeWidth,
            }
            setDragging(true)
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!drag.current) return
            event.preventDefault()
            event.stopPropagation()
            onColumnResize(clampColumnWidth(drag.current.width + event.clientX - drag.current.x, minWidth))
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={() => {
            drag.current = null
            setDragging(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            event.stopPropagation()
            onColumnResize(clampColumnWidth(resizeWidth + (event.key === 'ArrowRight' ? 16 : -16), minWidth))
          }}
        />
      )}
    </th>
  )
}
