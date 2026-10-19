"use client";

/**
 * SideNav —— 桌面端左侧导航
 *
 * 5 个真实页面：学习 / 排行榜 / 错题本 / 商店 / 我的
 *
 * 响应式（web-shell-14）：
 *   - md (768-1023)：icon-only 窄栏（AppShell 给 72px），文字隐藏
 *   - lg+：完整 200px，图标 + 文字
 * Filled learning illustrations; blue border and surface mark the current page.
 * 底部：免费深色模式三态开关。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Home as HomeIcon,
  Shield as Trophy,
  Bookmark,
  ShoppingBag,
  User,
  type IconProps,
} from "@/components/LearningIcon";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { cn } from "@/lib/cn";
import { playSfx } from "@/lib/sfx";
import { haptic } from "@/lib/haptic";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
  matchPrefix: string;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "学习", Icon: HomeIcon, matchPrefix: "/learn-root" },
  { href: "/league/", label: "排行榜", Icon: Trophy, matchPrefix: "/league" },
  { href: "/review/", label: "错题本", Icon: Bookmark, matchPrefix: "/review" },
  { href: "/shop/", label: "商店", Icon: ShoppingBag, matchPrefix: "/shop" },
  { href: "/profile/", label: "我的", Icon: User, matchPrefix: "/profile" },
];

function isActiveLearn(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/grade/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/lesson/") ||
    pathname.startsWith("/stories/") ||
    pathname.startsWith("/reading/")
  );
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.label === "学习") return isActiveLearn(pathname);
  return pathname.startsWith(item.matchPrefix);
}

export function SideNav() {
  const pathname = usePathname() ?? "/";

  const items = ITEMS;

  return (
    <nav className="flex flex-col gap-2 w-full h-full" aria-label="主导航">
      {/* Logo —— 文字 wordmark（lg+）；md 窄栏显示熊猫图标 */}
      <Link
        href="/"
        onClick={() => {
          playSfx("tap");
          haptic("light");
        }}
        className="block px-3 py-3 mb-2"
        aria-label="聪聪学堂 · 回到首页"
      >
        <span className="hidden lg:inline brand-wordmark text-2xl tracking-tightest">
          聪聪学堂
        </span>
        <span className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10 text-primary font-extrabold text-lg">
          聪
        </span>
      </Link>

      {items.map(item => {
        const active = isActive(pathname, item);
        const Icon = item.Icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => {
              playSfx("tap");
              haptic("light");
            }}
            className={cn(
              "group flex items-center justify-center lg:justify-start gap-3 px-3 h-[52px] rounded-xl border-2 transition-colors select-none",
              active
                ? "border-secondary/50 bg-secondary/10 text-secondary-dark"
                : "border-transparent text-ink-light hover:bg-bg-soft"
            )}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <Icon
              className={cn(
                "w-8 h-8 shrink-0",
                active ? "text-primary-dark" : "text-ink-softer group-hover:text-ink-light"
              )}
            />
            <span
              className={cn(
                "nav-label hidden lg:inline",
                active ? "text-secondary-dark" : "text-ink-light group-hover:text-ink"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* 底部：深色模式三态开关（md 窄栏收成纯图标） */}
      <div className="mt-auto pt-4 pb-2 px-1">
        <ThemeModeToggle compact />
      </div>
    </nav>
  );
}
