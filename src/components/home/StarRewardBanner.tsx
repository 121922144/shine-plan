import { homeMock } from '../../features/home/homeMock'

export function StarRewardBanner() {
  return (
    <aside className="shine-encouragement" aria-label="每一小步，都值得一颗星">
      <p>每一小步，都值得一颗星</p>
      <span className="shine-encouragement-stars" aria-hidden="true">{Array.from({ length: homeMock.todayStars }, (_, index) => <img key={index} className="shine-encouragement-star" src="/assets/icons/star.png" alt="" width="27" height="27" decoding="async" />)}</span>
    </aside>
  )
}
