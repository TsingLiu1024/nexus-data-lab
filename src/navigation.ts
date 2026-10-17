import { Grid2X2, Table2, SlidersHorizontal } from 'lucide-react'
export type View = 'overview' | 'table' | 'profiles'
export const VIEWS = [
  { key: 'overview', label: '分析概览', Icon: Grid2X2 },
  { key: 'table', label: '数据表格', Icon: Table2 },
  { key: 'profiles', label: '字段分析', Icon: SlidersHorizontal },
] as const
