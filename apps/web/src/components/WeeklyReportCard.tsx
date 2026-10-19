"use client";

/**
 * WeeklyReportCard —— 本周学习报告卡片
 *
 * 数据来源：useProgressStore.xpHistory + lessonHistory（最近 60 天滚动）
 * 显示：
 *   - 本周（周一→周日）每日 XP 柱状图
 *   - 总 XP / 完成课时 / 学习天数
 *   - 与上周对比的小变化
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { dateKey, weeklyStudyReport } from "@cstf/core/week";
import { useProgressTicker } from "@/lib/useProgressTicker";
import { useProgressStore } from "@/store/progress";
import { Calendar, TrendingUp, Lightning } from "@/components/icons";

export function WeeklyReportCard() {
  const xpHistory = useProgressStore(s => s.xpHistory);
  const lessonHistory = useProgressStore(s => s.lessonHistory);

  const studyDays = useProgressStore(s => s.studyDays);
  const completedReadings = useProgressStore(s => s.completedReadings);
  const today = dateKey(new Date(useProgressTicker()));
  const data = useMemo(() => weeklyStudyReport({ xpHistory, lessonHistory, studyDays, completedReadings }),
    [xpHistory, lessonHistory, studyDays, completedReadings, today]);
  return <WeeklyReportView data={data} />;
}

export function WeeklyReportView({ data }: { data: ReturnType<typeof weeklyStudyReport> }) {
  return (
    <section
      className="bg-white rounded-3xl border-2 border-bg-softer p-5"
      style={{ boxShadow: "0 4px 0 0 var(--shadow-card-color)" }}
      aria-label="本周学习报告"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-secondary" />
          <div className="text-base font-extrabold text-ink">本周报告</div>
        </div>
        {data.xpDelta !== 0 && (
          <div
            className={`text-xs font-extrabold inline-flex items-center gap-1 ${
              data.xpDelta > 0 ? "text-primary" : "text-ink-softer"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {data.xpDelta > 0 ? "+" : ""}
            {data.xpDelta} XP
          </div>
        )}
      </div>

      {/* Stats 三连 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat label="本周 XP" value={data.totalXp} />
        <MiniStat label="完成课时" value={data.totalLessons} />
        <MiniStat label="学习天数" value={`${data.activeDays}/7`} />
      </div>

      {/* 柱状图 */}
      <div className="flex items-end justify-between gap-1.5 h-24 mb-1">
        {data.thisWeek.map((d, idx) => {
          const pct = (d.xp / data.maxXp) * 100;
          return (
            <motion.div
              key={d.date}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "100%", opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex-1 flex flex-col items-center justify-end"
            >
              <div
                className={`w-full rounded-t-md transition-all ${
                  d.isToday && d.studied ? "bg-primary" : d.studied ? "bg-secondary" : "bg-bg-softer"
                }`}
                style={{
                  height: `${Math.max(d.studied ? 12 : 6, pct)}%`,
                  minHeight: d.studied ? "12px" : "4px",
                }}
                role="img"
                aria-label={`${d.label}：${d.xp} XP · ${d.studied ? "已学习" : "没有学习记录"}`}
                title={`${d.label}：${d.xp} XP · ${d.studied ? "已学习" : "没有学习记录"}`}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-end justify-between gap-1.5">
        {data.thisWeek.map(d => (
          <div
            key={d.date}
            className={`flex-1 text-center text-[10px] font-extrabold ${
              d.isToday ? "text-primary" : "text-ink-softer"
            }`}
          >
            {d.label}
          </div>
        ))}
      </div>

      {data.activeDays > 0 && data.totalXp === 0 && <p className="mt-4 text-center text-xs text-ink-light">认真练习、改错都算学习，经验值不代表全部进步。</p>}
      {data.activeDays === 0 && (
        <p className="mt-4 text-center text-xs text-ink-softer inline-flex items-center justify-center gap-1 w-full">
          <Lightning className="w-3 h-3" />
          本周还没有学习记录，去开始一节课吧
        </p>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-bg-soft rounded-xl p-2.5 text-center">
      <div className="text-xl font-extrabold text-ink tabular-nums leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ink-softer font-extrabold mt-1">
        {label}
      </div>
    </div>
  );
}
