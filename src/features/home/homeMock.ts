// TODO: 接入陪伴、奖励和消息统计。仅供首页展示，不写入本地或云端业务数据。
export const homeMock = {
  companionDays: 12,
  todayStars: 3,
  streakDays: 5,
  starsToNextBadge: 2,
  badgeProgress: 44,
  hasUnreadNotification: true,
  // 沿用原首页的任务演示规则；prepared 状态仍由 SmartHome 管理。
  initialCompletedGoals: 2,
  totalGoals: 3,
} as const

// TODO: 接入真实课程状态；示例标签不代表签到结果，不按当前时间推断。
export const mockCourseStatuses = ['待上课', '已上课'] as const
