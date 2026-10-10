"use client";

import { useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Download,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ScheduleCourseCard } from "../components/schedule/ScheduleCourseCard";
import { NoCoursePanel } from "../components/schedule/NoCoursePanel";
import { periodTime } from "../coursePresentation";
import type { ReminderSettings, Slot } from "../domain";

export type { ReminderSettings, Slot } from "../domain";

const DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1);
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function courseStatus(
  date: Date,
  period: number,
  hasCourse: boolean,
): "已上课" | "待上课" | "休息" {
  if (!hasCourse) return "休息";
  const today = startOfDay(new Date());
  const selected = startOfDay(date);
  if (selected < today) return "已上课";
  if (selected > today) return "待上课";
  const endTime = periodTime(period).split(" - ")[1];
  if (!endTime) return "待上课";
  const [hour, minute] = endTime.split(":").map(Number);
  const end = new Date(date);
  end.setHours(hour, minute, 0, 0);
  return new Date() > end ? "已上课" : "待上课";
}

function Switch({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={active ? "toggle active" : "toggle"}
      onClick={onClick}
      aria-label={label}
      type="button"
    >
      <span />
    </button>
  );
}

export function SchedulePage({
  slots,
  onChange,
  onImport,
}: {
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
  onImport: () => void;
}) {
  const [day, setDay] = useState(Math.min(5, Math.max(1, new Date().getDay())));
  const [weekOffset, setWeekOffset] = useState(0);
  const isSchoolDay = day >= 1 && day <= 5;
  const getSlot = (period: number) =>
    slots.find((slot) => slot.day === day && slot.period === period);
  const update = (period: number, name: string) => {
    if (!isSchoolDay) return;
    const current = getSlot(period);
    if (current)
      onChange(
        name.trim()
          ? slots.map((slot) =>
              slot.id === current.id ? { ...slot, name } : slot,
            )
          : slots.filter((slot) => slot.id !== current.id),
      );
    else if (name.trim())
      onChange([...slots, { id: uid(), day, period, name }]);
  };
  const today = startOfDay(new Date());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekDates = WEEK_DAYS.map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const selectedDate = weekDates[WEEK_DAYS.indexOf(day)];
  const selectedSlots = slots.filter(
    (slot) => slot.day === day && slot.name.trim().length > 0,
  );
  const isToday = sameDate(selectedDate, today);
  const selectedLabel = isToday ? "今天" : DAYS[day];

  return (
    <section className="schedule-page">
      <section className="schedule-banner">
        <img
          className="schedule-banner-art"
          src="/assets/banners/schedule-banner.png"
          alt=""
        />
        <div className="schedule-banner-copy">
          <h1>我的课表</h1>
          <p>每一天，都安排得闪闪发光</p>
        </div>
      </section>

      <div className="schedule-content">
        <section className="schedule-date-card" aria-label="选择课表日期">
          <div className="schedule-month-row">
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value - 1)}
              aria-label="上一周"
            >
              <ChevronLeft />
            </button>
            <strong>
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月
            </strong>
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value + 1)}
              aria-label="下一周"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="schedule-date-grid">
            {WEEK_DAYS.map((item, index) => {
              const date = weekDates[index];
              const hasCourses = slots.some((slot) => slot.day === item);
              return (
                <button
                  key={`${weekOffset}-${item}`}
                  type="button"
                  className={day === item ? "is-selected" : ""}
                  aria-pressed={day === item}
                  aria-label={`${date.getMonth() + 1}月${date.getDate()}日 ${DAYS[item]}，${hasCourses ? "有课程" : "无课程"}`}
                  onClick={() => setDay(item)}
                >
                  <span>{DAYS[item].slice(1)}</span>
                  <strong>{date.getDate()}</strong>
                </button>
              );
            })}
          </div>
        </section>

        <div className="schedule-section-title">
          <div className="schedule-section-copy">
            <h2>
              {selectedLabel} · {selectedDate.getMonth() + 1}月
              {selectedDate.getDate()}日
            </h2>
            <p>{isSchoolDay ? "课程名称可以直接修改" : "周末休息一下吧"}</p>
          </div>
          <div className="schedule-section-actions">
            <span className="schedule-section-count">
              {selectedSlots.length}节课程
            </span>
            <button
              className="schedule-reimport"
              type="button"
              onClick={onImport}
            >
              <RefreshCw />
              重新导入
            </button>
          </div>
        </div>

        <div className="schedule-course-list">
          {selectedSlots.length === 0 ? (
            <NoCoursePanel isWeekend={!isSchoolDay} isToday={isToday} />
          ) : (
            PERIODS.map((period) => {
              const slot = getSlot(period);
              return (
                <ScheduleCourseCard
                  key={`${day}-${period}`}
                  period={period}
                  slot={slot}
                  status={courseStatus(selectedDate, period, Boolean(slot))}
                  readOnly={!isSchoolDay}
                  onChange={(name) => update(period, name)}
                />
              );
            })
          )}
        </div>

        <p className="schedule-local-note">
          <Sparkles />
          课表按星期循环展示，修改后会自动保存
        </p>
      </div>
    </section>
  );
}

export function SettingsPage({
  reminder,
  onReminderChange,
  onEnable,
  onDisable,
  onCalendar,
  onInstall,
  onReset,
  cloudStatus,
  pushStatus,
  isIos,
  isStandalone,
}: {
  reminder: ReminderSettings;
  onReminderChange: (value: ReminderSettings) => void;
  onEnable: () => void;
  onDisable: () => void;
  onCalendar: () => void;
  onInstall: () => void;
  onReset: () => void;
  cloudStatus: string;
  pushStatus: string;
  isIos: boolean;
  isStandalone: boolean;
}) {
  const cloudOnline = cloudStatus.includes("已同步");
  const reminderNeedsSetup = pushStatus.includes("未配置提醒服务");

  return (
    <section className="settings-page">
      <div className="settings-content">
        <section className="schedule-banner" aria-label="设置页横幅">
          <img
            className="schedule-banner-art"
            src="/assets/banners/config-banner.png"
            alt=""
          />
          <div className="schedule-banner-copy">
            <h1>我的设置</h1>
            <p>和小松鼠一起成长</p>
          </div>
        </section>

        <div className="settings-actions">
          <h2 className="settings-group-title">提醒设置</h2>
          <article className="settings-card reminder-card">
            <div className="settings-list">
              <div className="setting-row">
                <span className="setting-icon coral">
                  <BellRing />
                </span>
                <div>
                  <h3>每日提醒</h3>
                  <p>{pushStatus}</p>
                </div>
                <Switch
                  active={reminder.enabled}
                  onClick={() => (reminder.enabled ? onDisable() : onEnable())}
                  label="切换每日提醒"
                />
              </div>
              <label className="setting-row">
                <span className="setting-icon yellow">
                  <Clock3 />
                </span>
                <div>
                  <h3>提醒时间</h3>
                  <p>按设定时间提醒明天课程</p>
                </div>
                <input
                  className="time-input"
                  type="time"
                  value={reminder.time}
                  onChange={(event) =>
                    onReminderChange({ ...reminder, time: event.target.value })
                  }
                />
              </label>
            </div>
          </article>
        </div>

        <div className="settings-push-status" role="status">
          <BellRing />
          <span>
            {reminder.enabled
              ? `通知订阅已开启${reminder.lastSent ? `，最近发送于 ${reminder.lastSent}` : ""}。每日定时发送需完成调度配置。`
              : reminderNeedsSetup
                ? "当前预览版还没有连接独立的后台提醒服务。可以先使用下方「添加到系统日历」，或等待后端配置完成。"
                : "后台推送尚未开启，开启每日提醒后可收到课程通知。"}
          </span>
        </div>

        <div className="settings-actions">
          <button className="setting-action" onClick={onCalendar}>
            <span className="setting-icon calendar">
              <CalendarDays />
            </span>
            <div>
              <h3>添加到系统日历</h3>
            </div>
            <ChevronRight />
          </button>
          <h2 className="settings-group-title">在手机上使用</h2>
          <button className="setting-action" onClick={onInstall}>
            <span className="setting-icon mint">
              <Download />
            </span>
            <div>
              <h3>{isStandalone ? "已从手机桌面打开" : "从手机桌面打开"}</h3>
              <p>
                {isIos && !isStandalone
                  ? "iPhone 需先添加到主屏幕"
                  : "像普通 App 一样快速打开"}
              </p>
            </div>
            <ChevronRight />
          </button>
          <h2 className="settings-group-title">数据</h2>
          <div className="setting-action static">
            <span className="setting-icon blue">
              <Cloud />
            </span>
            <div>
              <h3>{cloudOnline ? "匿名云端保存" : "本机保存"}</h3>
              <p>{cloudStatus}</p>
            </div>
            <span
              className={
                cloudOnline ? "settings-sync-dot online" : "settings-sync-dot"
              }
              aria-label={cloudOnline ? "已同步" : "未同步"}
            />
            <ChevronRight aria-hidden="true" />
          </div>
        </div>

        <button className="danger-action" onClick={onReset}>
          <Trash2 size={18} />
          清空课程与日期提醒
        </button>
        <p className="local-note">
          {cloudOnline
            ? "课程表图片不会上传；只有确认后的课程和日期提醒会匿名保存。"
            : "课程表图片不会上传；课程与提醒时间暂保存在本机，清理浏览器数据可能会丢失。"} 
        </p>
        <p className="settings-footer">
          <img src="/assets/icons/star.png" alt="" />
          陪伴每一颗小星星发光
          <img src="/assets/icons/star.png" alt="" />
        </p>
      </div>
    </section>
  );
}
