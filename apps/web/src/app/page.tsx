import { promises as fs } from "fs";
import path from "path";
import type { SiteIndex } from "@/types";
import { HomeClient } from "./HomeClient";

async function getIndex(): Promise<SiteIndex> {
  const p = path.join(process.cwd(), "public", "data", "index.json");
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

export default async function HomePage() {
  const index = await getIndex();

  // 按年级聚合（一年级有上下册两本）
  const byGrade: Record<number, typeof index.books> = {};
  for (const book of index.books) {
    if (book.supersededBy) continue;
    if (!byGrade[book.grade]) byGrade[book.grade] = [];
    byGrade[book.grade].push(book);
  }
  const grades = Object.keys(byGrade)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <HomeClient
      bookReplacements={Object.fromEntries(index.books.filter(b => b.supersededBy).map(b => [b.id, b.supersededBy!]))}
      grades={grades}
      byGrade={Object.fromEntries(grades.map(g => [g, byGrade[g].length]))}
      totalBooks={index.books.filter(b => !b.supersededBy).length}
      totalLessons={index.totalLessons}
      totalQuestions={index.totalQuestions}
    />
  );
}
