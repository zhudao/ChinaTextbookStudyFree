import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { NumberSenseProgress } from "@/components/NumberSenseProgress";
export default function NumberSensePage() {
  return (
    <AppShell right={null} centerMaxWidth={760}>
      <main className="px-4 py-4 sm:py-6">
        <Link
          className="min-h-11 inline-flex items-center font-bold text-secondary-dark mb-2"
          href="/book/g1up/"
        >
          ← 回到一年级数学
        </Link>
        <h1 className="text-3xl font-extrabold text-ink mb-3">
          一起数一数、比一比
        </h1>
        <p className="text-base text-ink-light mb-5">
          用小物体动手试，可以看提示，也可以放心改错。这三节练习不扣红心。
        </p>
        <NumberSenseProgress expanded />
        <section className="ui-card rounded-2xl bg-bg-soft p-4 text-ink">
          <h2 className="font-extrabold text-lg">学完，和家人一起试试</h2>
          <p className="mt-2 leading-loose">
            数数桌上的物品，把它们摆开后再数。再给每个人分一件，看看够不够。
          </p>
          <p className="mt-2 text-sm text-ink-light">
            “能独立做”来自本次无提示首答；“隔天仍会”需要下一天的新题检验。学习记录只保存在本机，可以在“我的”里备份。
          </p>
        </section>
      </main>
    </AppShell>
  );
}
