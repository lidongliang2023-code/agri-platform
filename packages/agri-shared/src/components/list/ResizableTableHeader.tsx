import { useRef } from 'react'
import type { ThHTMLAttributes, PointerEvent } from 'react'
import { MIN_RESIZABLE_COLUMN_WIDTH } from './listColumnUtils'

export interface ResizableTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  resizeWidth?: number
  onColumnResize?: (width: number) => void
  minWidth?: number
}

/** 共用列宽手柄：保留原表头排序、筛选事件，拖动不触发排序。 */
export default function ResizableTableHeader({
  resizeWidth,
  onColumnResize,
  minWidth = MIN_RESIZABLE_COLUMN_WIDTH,
  children,
  ...props
}: ResizableTableHeaderProps): JSX.Element {
  const drag = useRef<{ x: number; width: number } | null>(null)
  const stop = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    drag.current = null
  }
  return (
    <th {...props}>
      {children}
      {resizeWidth !== undefined && onColumnResize && (
        <span
          className="agri-column-resize-handle production-column-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整列宽"
          aria-valuenow={Math.round(resizeWidth)}
          aria-valuemin={minWidth}
          tabIndex={0}
          title="拖动调整列宽"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.stopPropagation()
            drag.current = {
              x: event.clientX,
              width: event.currentTarget.parentElement?.getBoundingClientRect().width ?? resizeWidth,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!drag.current) return
            event.preventDefault()
            event.stopPropagation()
            onColumnResize(Math.max(minWidth, Math.round(drag.current.width + event.clientX - drag.current.x)))
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={() => {
            drag.current = null
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            event.stopPropagation()
            onColumnResize(Math.max(minWidth, resizeWidth + (event.key === 'ArrowRight' ? 16 : -16)))
          }}
        />
      )}
    </th>
  )
}
