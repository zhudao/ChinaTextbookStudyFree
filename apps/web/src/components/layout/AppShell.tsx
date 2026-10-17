"use client";

/**
 * AppShell —— 响应式三栏布局壳（左 SideNav / 中央内容 / 右 RightRail）
 *
 * 断点（web-shell-14）：
 *   - < md：单列，底部 BottomNav（BottomNav 自身 md:hidden）
 *   - md (768-1023)：icon-only 72px SideNav + 中央列（max ~640），无右栏
 *   - lg：200px SideNav + 中央列；xl+ 才展示 288px RightRail
 *
 * 单树渲染：children 只挂载一次，通过同一组 CSS 断点控制两侧栏的显隐，
 * 避免旧版「移动端 + 桌面端各渲染一份 children」带来的音效 / observer /
 * ticker 双跑与重复 <main> 问题。
 *
 * 语义：AppShell 自身不再输出 <main>——由各页面的 children 提供唯一的
 * <main> 地标（现有壳内页面均已自带）。
 */

import type { CSSProperties, ReactNode } from "react";
import { SideNav } from "./SideNav";
import { RightRail } from "./RightRail";

interface AppShellProps {
  children: ReactNode;
  /** 自定义右栏。传 null 显式隐藏；不传则显示默认 RightRail */
  right?: ReactNode | null;
  /** 中央内容栏最大宽度（仅 md+ 生效），默认 640 */
  centerMaxWidth?: number;
}

export function AppShell({ children, right, centerMaxWidth = 640 }: AppShellProps) {
  const showRight = right !== null;
  return (
    <div className="app-shell" data-has-rail={showRight ? "true" : "false"}>
      <aside className="shell-sidebar">
        <SideNav />
      </aside>

      <div className="min-w-0">
        <div
          className="shell-content mx-auto w-full"
          style={{ "--center-max": `${centerMaxWidth}px` } as CSSProperties}
        >
          {children}
        </div>
      </div>

      {showRight && (
        <aside className="shell-rail">
          {right ?? <RightRail />}
        </aside>
      )}
    </div>
  );
}
