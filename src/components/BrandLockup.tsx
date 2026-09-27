import type { ReactNode } from 'react'

export function BrandLockup({ inverse = false, compact = false, title = '闪闪计划', subtitle = 'SHINE PLAN' }: { inverse?: boolean; compact?: boolean; title?: string; subtitle?: string }) {
  return (
    <div className={`brand-lockup${inverse ? ' inverse' : ''}${compact ? ' compact' : ''}`}>
      <span className="brand-logo" aria-hidden="true"><img src="/backpack-mascot.png" alt="" /></span>
      <span className="brand-copy"><strong>{title}</strong><small>{subtitle}</small></span>
    </div>
  )
}

export function HeroAction({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return <button className="hero-action" type="button" aria-label={label} onClick={onClick}>{children}<span>{label}</span></button>
}

export function Mascot({ className = '' }: { className?: string }) {
  return <img className={`mascot ${className}`} src="/backpack-mascot.png" alt="可爱的蓝色书包" />
}
