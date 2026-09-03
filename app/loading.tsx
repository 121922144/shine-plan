function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}

export default function Loading() {
  return (
    <div className="app-shell app-loading" aria-label="正在打开书包计划">
      <main className="phone-frame">
        <header className="topbar">
          <div className="brand-mark"><BookIcon /></div>
          <div><p className="eyebrow">BAG PLAN</p><h1>书包计划</h1></div>
          <div className="icon-button loading-icon" aria-hidden="true" />
        </header>
        <div className="page-content home-skeleton" aria-hidden="true">
          <div className="skeleton-hero" />
          <div className="skeleton-line skeleton-label" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-title short" />
          <div className="skeleton-line skeleton-copy" />
          <div className="skeleton-line skeleton-copy short" />
          <div className="skeleton-button" />
        </div>
        <nav className="bottom-nav skeleton-nav" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <span key={index}><i /><b /></span>)}
        </nav>
      </main>
    </div>
  )
}
