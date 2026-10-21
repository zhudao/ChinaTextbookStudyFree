import { SubjectBookIcon } from "@/components/LearningIcon";
import { promises as fs } from "fs";
import path from "path";
import { StatsBar } from "@/components/StatsBar";
import { SoundLink } from "@/components/SoundLink";
import { AppShell } from "@/components/layout/AppShell";
import { ChangeGradeButton } from "@/components/ChangeGradeButton";
import { ContinueLearningCard } from "@/components/ContinueLearningCard";
import type { SiteIndex, SubjectId, Book } from "@/types";
import { SUBJECTS } from "@/lib/subjects";

async function getIndex(): Promise<SiteIndex> {
  const p = path.join(process.cwd(), "public", "data", "index.json");
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

export async function generateStaticParams() {
  return [1, 2, 3, 4, 5, 6].map(g => ({ grade: String(g) }));
}

const TAGLINES: Record<SubjectId, string> = {
  math: "加减乘除 · 逻辑推理",
  chinese: "识字认词 · 阅读写作",
  english: "听说读写 · 启蒙英语",
  science: "探索自然 · 动手实验",
};

const SUBJECT_ORDER: SubjectId[] = ["math", "chinese", "english", "science"];

export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = await params;
  const gradeNum = Number(grade);
  const index = await getIndex();
  const allBooks = index.books.filter(b => b.grade === gradeNum && !b.supersededBy);

  const gradeName = ["", "一", "二", "三", "四", "五", "六"][gradeNum];

  // 按学科分组 —— math/chinese/english/science
  const bySubject = new Map<SubjectId, Book[]>();
  for (const b of allBooks) {
    const sid = (b.subject ?? "math") as SubjectId;
    if (!bySubject.has(sid)) bySubject.set(sid, []);
    bySubject.get(sid)!.push(b);
  }
  // 单本内按学期：上册 → 下册
  for (const [, arr] of bySubject) {
    arr.sort((a, b) => (a.semester === "up" ? -1 : 1) - (b.semester === "up" ? -1 : 1));
  }

  return (
    <AppShell centerMaxWidth={840}>
    <main className="min-h-screen flex flex-col items-center px-4 pt-4 pb-8 lg:pt-2 lg:px-0">
      {/* 页头：移动端带 compact StatsBar；lg+ 由右栏 RightRail 常驻 HUD，不再重复 */}
      <div className="w-full max-w-3xl lg:max-w-none">
        <div className="shell-page-toolbar flex justify-end mb-4">
          <StatsBar compact />
        </div>
        <div className="flex items-end justify-between gap-3 mb-5 lg:mb-8">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-ink leading-tight truncate">
            {gradeName}年级
          </h1>
          <div className="shrink-0">
            <ChangeGradeButton />
          </div>
        </div>
      </div>
      <ContinueLearningCard />
      <div className="w-full">

        <div className="space-y-6">
          {SUBJECT_ORDER.map(subjectId => {
            const subjectBooks = bySubject.get(subjectId);
            if (!subjectBooks || subjectBooks.length === 0) return null;
            const subject = SUBJECTS[subjectId];

            return (
              <section key={subjectId}>
                {/* 学科分组 header */}
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-base lg:text-xl font-extrabold text-ink">
                      {subject.label}
                    </div>
                    <div className="text-sm text-ink-light mt-0.5">{TAGLINES[subjectId]}</div>
                  </div>
                </div>

                {/* Shared book illustrations keep subject identity out of the text. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-5">
                  {subjectBooks.map(book => (
                    <SoundLink
                      key={book.id}
                      href={`/book/${book.id}/`}
                      aria-label={`${subject.label} ${book.textbookName}，${book.unitsCount} 单元${book.activitiesCount ? `，${book.activitiesCount} 个实践活动` : ""}，${book.lessonsCount} 节小课`}
                      hapticIntensity="medium"
                      className="duo-chunky-card ui-book-card group relative block rounded-2xl border-2 border-bg-softer select-none overflow-hidden"
                    >
                      <div className="relative flex items-center gap-3 lg:gap-4 px-4 py-4 lg:px-5 lg:py-5">
                        <SubjectBookIcon subject={subjectId} className="w-14 h-16 shrink-0" />

                        {/* 白色文字右侧 */}
                        <div className="flex-1 min-w-0 text-ink">
                          <div className="text-base lg:text-xl font-extrabold leading-tight truncate mt-0.5">
                            {book.gradeName}
                            {book.semesterName}
                            {book.editionLabel && <span className="ml-1 text-xs">（{book.editionLabel}）</span>}
                          </div>
                          <div className="text-sm text-ink-light mt-1">
                            {book.unitsCount} 单元{book.activitiesCount ? ` · ${book.activitiesCount} 个实践活动` : ""} · {book.lessonsCount} 节小课
                          </div>
                        </div>

                        {/* 右侧箭头 */}
                        <div className="text-ink-softer text-xl lg:text-2xl font-extrabold shrink-0 group-hover:translate-x-1 transition-transform">
                          ›
                        </div>
                      </div>

                    </SoundLink>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
    </AppShell>
  );
}
