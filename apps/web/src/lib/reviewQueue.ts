import { getDueSrsEntries, type SrsMistakeEntry } from "@cstf/core/srs";

/** Free heart recovery may practise future entries without advancing their SRS. */
export function reviewQueue(bank: SrsMistakeEntry[], forHeartRecovery: boolean) {
  const key = (entry: SrsMistakeEntry) => `${entry.lessonId}:${entry.question.id}`;
  const identities = new Set<string>();
  const unique = bank.filter(entry => { const id = key(entry); if (identities.has(id)) return false; identities.add(id); return true; });
  const allDue = getDueSrsEntries(unique);
  const due = forHeartRecovery ? allDue.slice(0, 5) : allDue;
  const seen = new Set(due.map(key));
  const queue = due.map(entry => ({ entry, scheduled: true }));
  if (forHeartRecovery) {
    for (const entry of unique) {
      if (queue.length >= 5) break;
      if (seen.has(key(entry))) continue;
      seen.add(key(entry));
      queue.push({ entry, scheduled: false });
    }
  }
  return queue;
}
