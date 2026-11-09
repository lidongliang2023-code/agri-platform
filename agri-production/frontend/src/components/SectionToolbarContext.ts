import { createContext } from 'react'

/** 将无独立标题的记录列表工具栏放入最近的分区标题栏。 */
export const SectionToolbarContext = createContext<HTMLDivElement | null>(null)
