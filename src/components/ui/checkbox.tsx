import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
}

export function Checkbox({ checked, className, ...props }: CheckboxProps) {
  return (
    <button
      type="button"
      aria-checked={checked}
      role="checkbox"
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        checked
          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
          : 'border-[var(--border)] bg-[var(--card)] text-transparent',
        className,
      )}
      {...props}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  )
}
