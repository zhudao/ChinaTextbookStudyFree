"use client";

/**
 * AchievementWall —— 个人中心的成就墙
 *
 * 网格展示所有成就，已解锁高亮 + 渐变边框；未解锁灰色 + 进度条。
 * 进入即调用 markAllSeen，清掉底部导航的红点。
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ALL_ACHIEVEMENTS,
  computeUnlockedAchievementIds,
  markAllSeen,
  type Achievement,
} from "@/lib/achievements";
import { useProgressStore } from "@/store/progress";
import { ShareCardButton } from "@/components/ShareCardButton";
import { renderBadgeCard } from "@/lib/shareCard";
import {
  Lightning,
  Flame,
  Star,
  Crown,
  Gem,
  Bookmark,
  Trophy,
  Rocket,
  Medal,
  Sparkle,
} from "@/components/icons";

const ICON_MAP = {
  lightning: Lightning,
  flame: Flame,
  star: Star,
  crown: Crown,
  gem: Gem,
  bookmark: Bookmark,
  trophy: Trophy,
  rocket: Rocket,
  medal: Medal,
  sparkle: Sparkle,
} as const;

export function AchievementWall() {
  const state = useProgressStore();
  const [expanded, setExpanded] = useState(false);
  // 账本 ∪ 实时集：已解锁（进账本）的成就永不"回灰"，
  // 实时集兜底账本尚未写入的瞬间（Watcher 稍后补账）
  const unlockedIds = useMemo(
    () => [
      ...new Set([
        ...Object.keys(state.unlockedAchievements),
        ...computeUnlockedAchievementIds(state),
      ]),
    ],
    [state],
  );
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  useEffect(() => {
    markAllSeen();
  }, [unlockedIds.join(",")]);

  const unlockedCount = unlockedIds.length;
  const totalCount = ALL_ACHIEVEMENTS.length;

  return (
    <section
      className="bg-white rounded-3xl border-2 border-bg-softer p-5"
      style={{ boxShadow: "0 4px 0 0 var(--shadow-card-color)" }}
      aria-label="成就墙"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-extrabold text-ink">成就</div>
        <div className="text-xs font-extrabold text-ink-light tabular-nums">
          <span className="text-primary">{unlockedCount}</span>
          <span className="text-ink-softer"> / {totalCount}</span>
        </div>
      </div>

      <div id="achievement-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(expanded ? ALL_ACHIEVEMENTS : ALL_ACHIEVEMENTS.slice(0, 4)).map((a, idx) => (
          <AchievementBadge
            key={a.id}
            ach={a}
            unlocked={unlockedSet.has(a.id)}
            progress={a.getProgress(state)}
            delay={idx * 0.025}
          />
        ))}
      </div>
      <button type="button" aria-expanded={expanded} aria-controls="achievement-grid"
        onClick={() => setExpanded(value => !value)}
        className="mt-4 min-h-11 w-full rounded-xl border border-bg-softer text-sm font-bold text-ink-light hover:bg-bg-soft">
        {expanded ? "收起成就" : `查看全部 ${totalCount} 项成就`}
      </button>
    </section>
  );
}

function AchievementBadge({
  ach,
  unlocked,
  progress,
  delay,
}: {
  ach: Achievement;
  unlocked: boolean;
  progress: number;
  delay: number;
}) {
  const Icon = ICON_MAP[ach.iconKey];
  const pct = Math.min(100, Math.round((progress / ach.goal) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.16), duration: 0.2 }}
      className={`relative flex flex-col items-center text-center p-2 rounded-2xl border-2 ${
        unlocked ? "bg-white" : "bg-bg-soft"
      }`}
      style={{
        borderColor: unlocked ? ach.color : "var(--app-border, #E5E5E5)",
        boxShadow: unlocked ? `0 3px 0 0 ${ach.color}` : "0 2px 0 0 var(--shadow-card-color)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: unlocked ? `${ach.color}22` : "var(--app-border, #E5E5E5)",
          color: unlocked ? ach.color : "#9CA3AF",
        }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div
        className={`text-sm font-extrabold mt-2 leading-snug ${
          unlocked ? "text-ink" : "text-ink-softer"
        }`}
        title={ach.name}
      >
        {ach.name}
      </div>
      <div className="text-xs text-ink-light leading-relaxed mt-1 min-h-[3em]">
        {ach.description}
      </div>
      {!unlocked ? (
        <div className="w-full h-1 mt-1.5 bg-bg-softer rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: ach.color }}
          />
        </div>
      ) : (
        // 📤 成就分享卡（E2）：本地渲染徽章卡 → 系统分享 / 降级下载
        <ShareCardButton
          makeBlob={() =>
            renderBadgeCard({
              heading: "成就解锁",
              title: ach.name,
              subtitle: ach.description,
            })
          }
          filename={`chengjiu-${ach.id}.png`}
          shareText={`我在聪聪学堂解锁了成就「${ach.name}」！`}
          className="mt-2 min-h-11 w-full inline-flex items-center justify-center text-xs font-bold text-ink-light rounded-xl border border-bg-softer transition-colors hover:bg-bg-soft"
        >
          <span>分享成就</span>
        </ShareCardButton>
      )}
    </motion.div>
  );
}
