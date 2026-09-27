import { HomeHero } from '../src/components/home/HomeHero'

export default function Loading() {
  return (
    <div className="app-shell app-loading shine-home-active" aria-label="正在打开闪闪计划">
      <main className="phone-frame">
        <div className="page-content home-skeleton shine-home-skeleton" aria-hidden="true">
          <HomeHero loading />
          <div className="skeleton-task" />
          <div className="skeleton-section"><div /><div /><div /></div>
        </div>
        <nav className="bottom-nav skeleton-nav" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <span key={index}><i /><b /></span>)}
        </nav>
      </main>
    </div>
  )
}
