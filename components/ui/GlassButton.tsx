'use client';

import React from 'react';

export type GlassButtonVariant = 'glass' | 'primary' | 'danger' | 'success' | 'light';
export type GlassButtonSize = 'sm' | 'md' | 'lg' | 'card' | 'icon';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const DEPTH: Record<GlassButtonSize, string> = {
  sm: 'border-b-[3px] active:translate-y-[3px] active:border-b-0',
  md: 'border-b-[4px] active:translate-y-[4px] active:border-b-0',
  lg: 'border-b-[6px] active:translate-y-[6px] active:border-b-0',
  card: 'border-b-[6px] active:translate-y-[6px] active:border-b-0',
  icon: 'border-b-[4px] active:translate-y-[4px] active:border-b-0',
};

const SIZE: Record<GlassButtonSize, string> = {
  sm: 'px-3 py-2 text-xs rounded-xl font-bold gap-2',
  md: 'px-4 py-2.5 text-sm rounded-xl font-bold gap-2',
  lg: 'px-6 py-4 text-base rounded-2xl font-bold gap-3',
  card: 'w-full p-6 rounded-[24px] gap-4 text-left',
  icon: 'p-3 rounded-2xl',
};

const VARIANT: Record<GlassButtonVariant, string> = {
  glass: cx(
    'bg-white/[0.04] backdrop-blur-xl text-white',
    'border border-white/10 border-t-white/20 border-b-white/10',
    'shadow-[0_10px_20px_rgba(0,0,0,0.3),inset_0_-2px_10px_rgba(255,255,255,0.05)]',
    'hover:bg-white/[0.06] hover:border-b-white/25',
    'hover:shadow-[0_15px_30px_rgba(0,0,0,0.4),inset_0_-2px_15px_rgba(255,255,255,0.1)]',
    'active:bg-white/[0.08] active:border-b-transparent',
    'active:shadow-[0_2px_5px_rgba(0,0,0,0.4)]'
  ),
  primary: cx(
    'bg-[#D0BCFF] text-[#2A1B4E]',
    'border border-[#E8DCFF]/60 border-t-white/50 border-b-[#6D4BA8]',
    'shadow-[0_8px_18px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.4)]',
    'hover:bg-[#DCC9FF]',
    'active:border-b-transparent active:shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
  ),
  danger: cx(
    'bg-red-500/15 backdrop-blur-xl text-red-400',
    'border border-red-500/25 border-t-red-200/20 border-b-red-700/50',
    'shadow-[0_8px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]',
    'hover:bg-red-500/25',
    'active:border-b-transparent active:shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
  ),
  success: cx(
    'bg-green-500 text-white',
    'border border-green-300/40 border-t-white/30 border-b-green-800',
    'shadow-[0_8px_16px_rgba(34,197,94,0.25),inset_0_1px_0_rgba(255,255,255,0.25)]',
    'hover:bg-green-400',
    'active:border-b-transparent active:shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
  ),
  light: cx(
    'bg-white text-black',
    'border border-white/80 border-t-white border-b-neutral-400',
    'shadow-[0_8px_18px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]',
    'hover:bg-neutral-100',
    'active:border-b-transparent active:shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
  ),
};

const CARD_ICON_BOX = cx(
  'p-3 rounded-2xl transition-all duration-300 shrink-0',
  'bg-[#D0BCFF]/10 text-[#D0BCFF] border border-white/5',
  'shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]',
  'group-hover:bg-[#D0BCFF]/20 group-hover:scale-110',
  'group-active:scale-95 group-active:bg-[#D0BCFF]/5'
);

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    {
      children,
      className,
      icon,
      trailing,
      variant = 'glass',
      size = 'md',
      type = 'button',
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cx(
          'group relative inline-flex items-center',
          size === 'card' ? 'justify-between' : 'justify-center',
          'transition-all duration-150 ease-out focus:outline-none',
          'disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0',
          SIZE[size],
          DEPTH[size],
          VARIANT[variant],
          className
        )}
        {...props}
      >
        {icon ? (size === 'card' ? <div className={CARD_ICON_BOX}>{icon}</div> : icon) : null}
        {children}
        {trailing}
      </button>
    );
  }
);

export default GlassButton;