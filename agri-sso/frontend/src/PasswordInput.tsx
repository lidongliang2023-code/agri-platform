import { useId, useState } from 'react'
import { Icon } from './Icon'

interface PasswordInputProps {
  /** 字段名，用于小眼睛按钮的无障碍文案（显示密码 / 隐藏密码） */
  label: string
  /** 当前值 */
  value: string
  /** 值变更回调 */
  onChange: (value: string) => void
  /** 输入框 id；外部若用 label htmlFor 关联则必须传入 */
  id?: string
  /** 占位提示 */
  placeholder?: string
  /** 浏览器自动填充提示 */
  autoComplete?: string
  /** 最大长度 */
  maxLength?: number
  /** 是否自动聚焦 */
  autoFocus?: boolean
}

/**
 * 密码输入框：右侧带「显示 / 隐藏密码」小眼睛按钮。
 *
 * 默认密文；显示状态由组件内部持有，同一页面上的多个密码框各自独立、互不影响。
 */
export function PasswordInput({
  label,
  value,
  onChange,
  id,
  placeholder,
  autoComplete,
  maxLength,
  autoFocus,
}: PasswordInputProps): JSX.Element {
  const autoId = useId().replace(/:/g, '')
  const inputId = id ?? `password-${autoId}`
  const [visible, setVisible] = useState(false)
  const toggleText = `${visible ? '隐藏' : '显示'}${label}`

  return (
    <div className="password-row">
      <input
        id={inputId}
        className="auth-input"
        type={visible ? 'text' : 'password'}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={toggleText}
        title={toggleText}
        aria-pressed={visible}
        aria-controls={inputId}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={19} />
      </button>
    </div>
  )
}
