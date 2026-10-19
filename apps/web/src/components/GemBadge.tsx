"use client";

/**
 * GemBadge —— 顶栏宝石计数胶囊。
 *
 * 和 StatsBar 上的 红心 / 连胜 / XP 保持一致的视觉风格（带边框的胶囊 + 图标 + 数字）。
 * 数字变化时轻微弹入，不使用会撑宽右栏的外扩光圈。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useProgressStore } from "@/store/progress";
import { Gem } from "@/components/LearningIcon";

interface GemBadgeProps {
  className?: string;
  /** 是否包成链接（默认 true，点击进商店） */
  asLink?: boolean;
}

export function GemBadge({ className = "", asLink = true }: GemBadgeProps) {
  const gems = useProgressStore(s => s.gems);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const display = hydrated ? gems : 0;

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className={`status-counter relative min-h-11 px-2 inline-flex items-center gap-2 rounded-xl font-extrabold text-base select-none tabular-nums text-gem ${asLink ? "hover:bg-bg-soft transition-colors cursor-pointer" : ""} ${className}`}
      aria-label={asLink ? `宝石 ${display}，进入商店` : `可用宝石 ${display}`}
    >
      <Gem className="w-6 h-6" />
      <motion.span
        className="text-gem"
        key={display}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 18 }}
      >
        {display}
      </motion.span>

    </motion.div>
  );

  if (asLink) {
    return <Link href="/shop/">{inner}</Link>;
  }
  return inner;
}
