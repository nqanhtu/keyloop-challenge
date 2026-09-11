import type { ButtonHTMLAttributes, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight; defaults to the secondary control surface. */
  variant?: ButtonVariant;
  /** React 19 passes `ref` as a regular prop for function components. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * U03 shared primitive: the one button both features compose. It renders a
 * native `<button>` (so role, name, keyboard behavior and form semantics are
 * never re-implemented) and maps the variant to `.ui-button--*`.
 */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return <button ref={ref} type={type} className={classes} {...rest} />;
}
