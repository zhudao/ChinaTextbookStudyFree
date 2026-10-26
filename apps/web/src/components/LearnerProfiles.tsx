"use client";

import { useEffect, useState, type FormEvent } from "react";
import { learnerProfiles, type LearnerProfile } from "@/lib/learnerProfiles";

export function LearnerProfiles() {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"create" | "rename" | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    try { const manager = learnerProfiles(); setProfiles(manager.list()); setActiveId(manager.activeId); }
    catch { setError("浏览器存储不可用，暂时无法管理学习档案。"); }
  }, []);
  function switchTo(id: string) {
    try {
      learnerProfiles().prepareSwitch(id);
      setSwitching(true);
      window.location.assign("/");
    } catch { setError("无法切换档案，请检查浏览器存储空间后重试。"); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const manager = learnerProfiles();
      if (mode === "create") { switchTo(manager.create(name).id); }
      else { manager.rename(name); setProfiles(manager.list()); setMode(null); setName(""); }
    } catch (e) { setError(e instanceof Error && e.message.startsWith("请输入") ? e.message : "无法保存档案，请检查浏览器存储空间后重试。"); }
  }
  return <section className="bg-white rounded-3xl border-2 border-bg-softer p-5 mb-8" aria-labelledby="learner-heading">
    <h2 id="learner-heading" className="font-extrabold text-ink">学习档案</h2>
    <p className="text-sm text-ink-light mt-1 mb-4">每个孩子有自己的年级、进度、错题和奖励。档案保存在当前浏览器，清除浏览器数据会丢失记录。</p>
    <div className="flex flex-wrap gap-2">
      {profiles.map(p => <button key={p.id} type="button" disabled={switching || p.id === activeId}
        aria-pressed={p.id === activeId} onClick={() => switchTo(p.id)}
        className={`min-h-11 max-w-full break-words rounded-2xl border-2 px-4 py-2 text-sm font-bold ${p.id === activeId ? "border-primary bg-primary/10 text-ink" : "border-bg-softer text-ink-light hover:border-primary"}`}>
        {p.name}{p.id === activeId ? " · 当前" : ""}
      </button>)}
    </div>
    {activeId && <div className="flex flex-wrap gap-4 mt-4 text-sm font-bold text-primary">
      <button type="button" className="min-h-11 min-w-11 px-2" disabled={switching} onClick={() => { setMode("create"); setName(""); setError(""); }}>添加孩子</button>
      <button type="button" className="min-h-11 min-w-11 px-2" disabled={switching} onClick={() => { setMode("rename"); setName(profiles.find(p => p.id === activeId)?.name ?? ""); setError(""); }}>修改当前名字</button>
    </div>}
    {mode && <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm text-ink flex-1 min-w-0">{mode === "create" ? "新档案名字" : "当前档案名字"}
        <input autoFocus required maxLength={20} value={name} onChange={e => setName(e.target.value)}
          className="min-h-11 w-full rounded-xl border-2 border-bg-softer px-3 text-ink" />
      </label>
      <button disabled={switching} type="submit" className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white">{mode === "create" ? "创建并切换" : "保存"}</button>
      <button type="button" className="min-h-11 px-2 text-ink-light" onClick={() => setMode(null)}>取消</button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {switching && <p role="status" className="mt-3 text-sm text-ink-light">正在切换学习档案…</p>}
  </section>;
}
