export function NoCoursePanel({ isWeekend, isToday }: { isWeekend: boolean; isToday: boolean }) {
  const title = isWeekend ? '周末没有课程' : isToday ? '今天没有课程' : '这天没有课程'
  const description = isWeekend ? '周末轻松一下，也可以看看下周安排' : '可以打开课表查看和调整安排'

  return <div className="shine-no-course" role="status">
    <span className="shine-no-course-art"><img src="/course-icons/no-course.png" alt="" /></span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
}
