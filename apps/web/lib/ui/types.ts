/** A single option rendered by the custom select listbox. */
export interface SelectOption<V extends string> {
  value: V
  label: string
  description?: string
  disabled?: boolean
}

/** A single action rendered by the custom dropdown menu. */
export interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separatorBefore?: boolean
}

export type SelectVariant = 'field' | 'inline' | 'ghost'
export type MenuAlign = 'start' | 'end'
