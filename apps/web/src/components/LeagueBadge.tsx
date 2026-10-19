import type { IconProps } from "./icons";

/** A broad shield silhouette for the locked league, without an icon-in-a-circle. */
export function LeagueBadge({ size = 104, locked = true, tone = "#1CB0F6", emblemTone = "#FFFFFF", ...props }: IconProps & { locked?: boolean; tone?: string; emblemTone?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 120" width={size} height={size} aria-hidden="true" focusable="false" {...props}>
      <path fill={locked ? "#A4B6C4" : tone} d="M21 8h64q9 0 9 9v42c0 24-15 43-36 51q-6 3-12 0C25 102 12 83 12 59V17q0-9 9-9Z" />
      <path fill={locked ? "#D5E2EB" : tone} d="M19 4h66q9 0 9 9v42c0 24-15 43-36 51q-6 3-12 0C25 98 10 79 10 55V13q0-9 9-9Z" />
      <path fill={locked ? "#EBF2F7" : "#FFFFFF"} opacity={locked ? 1 : .2} d="M22 12h60q4 0 4 4v38c0 22-13 36-30 44q-4 2-8 0C31 90 18 76 18 54V16q0-4 4-4Z" />
      <path fill={locked ? "#C1D3E1" : tone} d="M52 12h30q4 0 4 4v38c0 22-13 36-30 44l-4 2Z" />
      {locked ? <>
      <path fill="#9CB3C6" d="M39 49V38a13 13 0 0 1 26 0v11h-7V38a6 6 0 0 0-12 0v11Z" />
      <rect fill="#8BA5BA" x="33" y="45" width="38" height="30" rx="8" />
      <path fill="#DCE9F2" d="M56 56a4 4 0 1 0-8 0 4 4 0 0 0 2 3.5V65h4v-5.5a4 4 0 0 0 2-3.5Z" />
      </> : <path fill={emblemTone} d="m52 31 7 14 16 2-12 12 3 16-14-7-14 7 3-16-12-12 16-2Z" />}
    </svg>
  );
}


export function LeagueBadgeGroup() {
  return <div className="relative w-56 h-36" aria-hidden="true">
    <LeagueBadge locked={false} tone="#1CB0F6" emblemTone="#1899D6" className="absolute w-24 h-28 left-0 top-4 -rotate-[20deg]" />
    <LeagueBadge locked={false} tone="#CE82FF" emblemTone="#A568CC" className="absolute w-24 h-28 right-0 top-4 rotate-[20deg]" />
    <LeagueBadge locked={false} tone="#FFC800" emblemTone="#E8A000" className="absolute w-28 h-32 left-1/2 top-0 -translate-x-1/2" />
  </div>;
}
