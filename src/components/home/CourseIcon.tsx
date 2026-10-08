import { useState } from 'react'
import { BookOpen, FlaskConical } from 'lucide-react'
import { fallbackCourseIcon } from '../../features/home/courseIconMap'

export function CourseIcon({ src }: { src: string }) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const displaySrc = failedSources.includes(src) ? fallbackCourseIcon : src
  const isScience = /\/science\.png(?:\?|$)/.test(src)

  return (
    <span className="shine-course-icon" aria-hidden="true" style={isScience ? { position: "relative" } : undefined}>
      {isScience && <FlaskConical style={{ position: "absolute", inset: "12.5%", width: "75%", height: "75%", color: "#60b8ed", zIndex: 0 }} />}
      {displaySrc === fallbackCourseIcon || failedSources.includes(displaySrc) ? <BookOpen /> : (
        <img
          src={displaySrc}
          alt=""
          width="38"
          height="38"
          decoding="async"
          style={isScience ? { position: "relative", zIndex: 1 } : undefined}
          onError={() => setFailedSources(previous => previous.includes(displaySrc) ? previous : [...previous, displaySrc])}
        />
      )}
    </span>
  )
}
