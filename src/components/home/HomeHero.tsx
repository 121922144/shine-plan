import { homeMock } from '../../features/home/homeMock'

export function HomeHero({ loading = false }: { loading?: boolean }) {
  return (
    <header className="shine-hero">
      <img className="shine-hero-art" src="/assets/banners/home-hero.png" alt="" fetchPriority="high" />
      <div className="shine-hero-content">
        <div className="shine-hero-topline">
          <img className="shine-logo" src="/assets/logo/logo-shine-plan.png" alt="闪闪计划 SHINE PLAN" width="297" height="103" />
        </div>
        <div className="shine-hero-copy">
          <h1>每天进步一点点</h1>
          <p>闪闪陪你一起闪闪发光</p>
          <span className="shine-companion">已陪伴 <strong>{homeMock.companionDays}</strong> 天</span>
        </div>
      </div>
    </header>
  )
}
