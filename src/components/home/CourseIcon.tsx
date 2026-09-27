import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { fallbackCourseIcon } from '../../features/home/courseIconMap'

export function CourseIcon({ src }: { src: string }) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const displaySrc = failedSources.includes(src) ? fallbackCourseIcon : src

  return (
    <span className="shine-course-icon" aria-hidden="true">
      {failedSources.includes(displaySrc) ? <BookOpen /> : (
        <img
          src={displaySrc}
          alt=""
          width="38"
          height="38"
          decoding="async"
          onError={() => setFailedSources(previous => previous.includes(displaySrc) ? previous : [...previous, displaySrc])}
        />
      )}
    </span>
  )
}
