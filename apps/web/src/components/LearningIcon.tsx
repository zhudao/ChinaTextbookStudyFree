import type { ReactNode } from "react";
import type { IconProps } from "./icons";

export type LearningIconName = "home" | "reading" | "review" | "shop" | "profile" | "trophy" | "heart" | "flame" | "gem" | "apple" | "sprout" | "tree" | "butterfly" | "rocket" | "star" | "crown" | "lightning" | "shield";

/** Product illustrations use broad silhouettes and two flat tones. Utility icons
 * remain single-color so a close or audio control never competes with content. */
const ART = {
    shield: <><path fill="#E8A000" d="M5 4h22v13c0 6-5 11-11 14C10 28 5 23 5 17Z"/><path fill="#FFC800" d="M5 2h22v13c0 6-5 11-11 14C10 26 5 21 5 15Z"/><path fill="#FFE477" d="M8 5h16L9 20a13 13 0 0 1-1-5Z"/></>,
    star: <><path fill="#E99400" d="m16 2 4.5 8.8 9.8 1.5-7.1 7 1.7 10L16 24.6 7.1 29.3l1.7-10-7.1-7 9.8-1.5Z"/><path fill="#FFC800" d="m16 2 4.5 8.8 9.8 1.5-10 3.7L16 24.6l-4.3-8.6-10-3.7 9.8-1.5Z"/><path fill="#FFDE69" d="m16 7 2.5 6.3-6.5-1Z"/></>,
    crown: <><path fill="#FFB020" d="M3 8 10 14 16 4l6 10 7-6-4 17H7Z"/><path fill="#FFC800" d="m3 8 9 10 4-14 4 14 9-10-4 17H7Z"/><rect fill="#E99400" x="7" y="26" width="18" height="4" rx="2"/><circle fill="#FF4B4B" cx="16" cy="21" r="2.5"/></>,
    lightning: <><path fill="#E99400" d="m19 1-15 18h10l-1 13 15-20H18Z"/><path fill="#FFC800" d="m19 1-2 14h8L13 32l1-13H4Z"/></>,
    home: <><path fill="#E8A000" d="M6 13h20v14a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z"/><path fill="#FFC800" d="M6 12h20v13a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z"/><path fill="#FF4B4B" stroke="#FF4B4B" strokeWidth="3" strokeLinejoin="round" d="M3 13 16 3l13 10-2 2-11-8L5 15Z"/><circle cx="16" cy="14" r="3" fill="#FFFFFF"/><path fill="#C47C00" d="M13 24a3 3 0 0 1 6 0v4h-6Z"/></>,
    reading: <><path fill="#1CB0F6" d="M3 7a2 2 0 0 1 2-2h6a8 8 0 0 1 5 2 8 8 0 0 1 5-2h6a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2h-6a8 8 0 0 0-5 2 8 8 0 0 0-5-2H5a2 2 0 0 1-2-2Z"/><path fill="#8ADCFF" d="M6 8h5a7 7 0 0 1 4 2v15a9 9 0 0 0-4-1H6Zm20 0h-5a7 7 0 0 0-4 2v15a9 9 0 0 1 4-1h5Z"/><path stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" d="M9 13h3m-3 5h3m8-5h3m-3 5h3"/></>,
    review: <><rect x="6" y="4" width="23" height="27" rx="5" fill="#A568CC"/><rect x="6" y="2" width="23" height="26" rx="5" fill="#CE82FF"/><path fill="#EBC5FF" d="M20 2h6v11l-3-2-3 2Z"/><path d="m13 19 3 3 7-7" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 9h5M3 17h5M3 25h5" stroke="#A568CC" strokeWidth="3" strokeLinecap="round"/></>,
    shop: <><rect x="5" y="10" width="22" height="20" rx="4" fill="#536E78"/><rect x="9" y="17" width="14" height="10" rx="2" fill="#FFFFFF"/><path fill="#536E78" d="M15 17h3v10h-3Z"/><path fill="#FF4B4B" d="M6 3h20l3 9v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0H3v-2Z"/><path fill="#FFFFFF" d="M10 3h5l-1 9v2a3 3 0 0 1-6 0v-2Zm10 0h5l2 9v2a3 3 0 0 1-6 0v-2Z"/><path d="M6 3h20" stroke="#EA2B2B" strokeWidth="2" strokeLinecap="round"/></>,
    profile: <><circle cx="16" cy="16" r="15" fill="#CE82FF"/><circle cx="9" cy="8" r="4" fill="#4B4B4B"/><circle cx="23" cy="8" r="4" fill="#4B4B4B"/><ellipse cx="16" cy="17" rx="11" ry="10" fill="#FFFFFF"/><ellipse cx="11.5" cy="15.5" rx="3.5" ry="4" transform="rotate(25 11.5 15.5)" fill="#4B4B4B"/><ellipse cx="20.5" cy="15.5" rx="3.5" ry="4" transform="rotate(-25 20.5 15.5)" fill="#4B4B4B"/><circle cx="12" cy="15" r="1.3" fill="#FFFFFF"/><circle cx="20" cy="15" r="1.3" fill="#FFFFFF"/><path fill="#4B4B4B" d="M13.5 21q2.5-2 5 0L16 23Z"/></>,
    trophy: <><path fill="#E99400" d="M7 7H3v6a8 8 0 0 0 8 8v-4a4 4 0 0 1-4-4Zm18 0h4v6a8 8 0 0 1-8 8v-4a4 4 0 0 0 4-4Z"/><path fill="#FFC800" d="M8 4h16v10a8 8 0 0 1-16 0Z"/><path fill="#FFDE69" d="M11 6h4v10a5 5 0 0 0 2 4 6 6 0 0 1-6-6Z"/><path fill="#E99400" d="M14 21h4v6h-4Z"/><rect fill="#FFC800" x="9" y="26" width="14" height="4" rx="2"/></>,
    heart: <><path fill="#EA2B2B" d="M16 29C12 26 2 19 2 11a8 8 0 0 1 14-5 8 8 0 0 1 14 5c0 8-10 15-14 18Z"/><path fill="#FF4B4B" d="M16 26C11 22 3 16 3 10a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 6-8 12-13 16Z"/><path stroke="#FF9C9C" strokeWidth="3" strokeLinecap="round" d="M7 11q0-4 4-4"/></>,
    flame: <><path fill="#FF9600" d="M18 2c4 6 2 9 1 11 3-1 4-3 4-5 6 7 8 12 4 18a13 13 0 0 1-22-1c-4-7 0-13 6-17 0 4 1 5 3 6 3-4 5-7 4-12Z"/><path fill="#FFC800" d="M17 15c4 5 7 7 4 11a6 6 0 0 1-10-1c-2-4 3-7 6-10Z"/></>,
    gem: <><path fill="#1899D6" d="m16 2 12 7v15l-12 7-12-7V9Z"/><path fill="#1CB0F6" d="m16 1 12 7v15l-12 7-12-7V8Z"/><path fill="#84D8FF" d="m16 1 6 3.5-12 7L4 8Z"/><path fill="#49C0F8" d="m16 15 12-7v15l-12 7Z"/></>,
    apple: <><path fill="#FF4B4B" d="M16 9C4 0-1 22 10 29c3 2 4 0 6 0s3 2 6 0C33 22 28 0 16 9Z"/><path fill="#EA2B2B" d="M21 9c7 7 4 16-3 20 3 2 5 0 7-3 4-7 3-15-4-17Z"/><path stroke="#875337" strokeWidth="3" strokeLinecap="round" d="M16 9V4"/><path fill="#58CC02" d="M17 6c0-5 7-5 9-3-1 4-6 5-9 3Z"/><path stroke="#FFC1C1" strokeWidth="3" strokeLinecap="round" d="M9 13q-3 2-2 6"/></>,
    sprout: <><path stroke="#58A700" strokeWidth="3.5" strokeLinecap="round" d="M16 26V14"/><path fill="#58CC02" d="M15 19C4 20 2 12 3 7c8-1 14 3 12 12Z"/><path fill="#89E219" d="M17 15C16 5 23 1 29 3c0 8-4 13-12 12Z"/><path fill="#B9845B" d="M8 25h16l-2 5H10Z"/></>,
    tree: <><rect fill="#B9845B" x="13" y="18" width="6" height="12" rx="2"/><path fill="#58A700" d="M5 18a7 7 0 0 1 2-12 9 9 0 0 1 17 0 7 7 0 0 1 1 13 9 9 0 0 1-20-1Z"/><path fill="#89E219" d="M5 13a6 6 0 0 1 5-5 7 7 0 0 1 12-2 7 7 0 0 1-3 12c-7 2-14 0-14-5Z"/></>,
    butterfly: <><path fill="#CE82FF" d="M15 15C4-3-3 7 4 18c-6 11 5 16 11 1Zm2 0C28-3 35 7 28 18c6 11-5 16-11 1Z"/><path fill="#E7B8FF" d="M11 14C4 4 3 10 7 15Zm10 0c7-10 8-4 4 1Z"/><path stroke="#8756AB" strokeWidth="3" strokeLinecap="round" d="M16 11v15m0-15-3-5m3 5 3-5"/></>,
    rocket: <><path fill="#FF9600" d="m11 22-6 6 2-9Zm10-11 6-5-1 9Z"/><path fill="#FF4B4B" d="m7 24 1 6 5-2 2-6Z"/><path fill="#1CB0F6" d="M10 24C9 12 17 3 29 3c0 12-9 20-19 21Z"/><path fill="#8ADCFF" d="M12 18C14 9 20 6 26 5c-3 5-7 10-14 13Z"/><circle fill="#FFFFFF" cx="21" cy="11" r="4"/><circle fill="#1899D6" cx="21" cy="11" r="2.5"/></>,
  } satisfies Record<LearningIconName, ReactNode>;

export function LearningIcon({ name, size = 32, ...props }: IconProps & { name: LearningIconName }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false" {...props}>{ART[name]}</svg>;
}

export function SubjectBookIcon({ subject, size = 56, ...props }: IconProps & { subject: "math" | "chinese" | "english" | "science" }) {
  const [cover, edge] = { math: ["#1CB0F6", "#1899D6"], chinese: ["#FF4B4B", "#EA2B2B"], english: ["#CE82FF", "#A568CC"], science: ["#58CC02", "#58A700"] }[subject];
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" width={size} height={typeof size === "number" ? size * 64 / 56 : size} aria-hidden="true" focusable="false" {...props}>
    <rect x="5" y="3" width="46" height="58" rx="7" fill={edge}/><path d="M12 50h37v8H12a4 4 0 0 1 0-8Z" fill="#FFFFFF"/><rect x="8" y="1" width="43" height="52" rx="6" fill={cover}/><path d="M13 7v39" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round"/>
    <g stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {subject === "math" ? <><path d="M22 17h12m-6-6v12m-6 12h12"/><circle cx="42" cy="29" r="1.5" fill="#FFFFFF" stroke="none"/><circle cx="42" cy="39" r="1.5" fill="#FFFFFF" stroke="none"/><path d="M38 34h8"/></> : subject === "chinese" ? <><path d="M20 14h23M31.5 10v5m-8 7 16 18m2-24q-2 17-20 24"/></> : subject === "english" ? <><path d="m22 39 9-24 9 24m-15-8h13"/></> : <><path d="M27 13h10m-8 1v10L21 37q-2 5 4 5h15q6 0 3-5l-8-13V14m-9 19h13"/></>}
    </g>
  </svg>;
}

export type { IconProps } from "./icons";
export const Home = (props: IconProps) => <LearningIcon {...props} name="home" />;
export const BookOpen = (props: IconProps) => <LearningIcon {...props} name="reading" />;
export const Bookmark = (props: IconProps) => <LearningIcon {...props} name="review" />;
export const ShoppingBag = (props: IconProps) => <LearningIcon {...props} name="shop" />;
export const User = (props: IconProps) => <LearningIcon {...props} name="profile" />;
export const Trophy = (props: IconProps) => <LearningIcon {...props} name="trophy" />;
export const Heart = (props: IconProps) => <LearningIcon {...props} name="heart" />;
export const Flame = (props: IconProps) => <LearningIcon {...props} name="flame" />;
export const Gem = (props: IconProps) => <LearningIcon {...props} name="gem" />;
export const Apple = (props: IconProps) => <LearningIcon {...props} name="apple" />;
export const Sprout = (props: IconProps) => <LearningIcon {...props} name="sprout" />;
export const Tree = (props: IconProps) => <LearningIcon {...props} name="tree" />;
export const Butterfly = (props: IconProps) => <LearningIcon {...props} name="butterfly" />;
export const Rocket = (props: IconProps) => <LearningIcon {...props} name="rocket" />;
export const Star = (props: IconProps) => <LearningIcon {...props} name="star" />;
export const Crown = (props: IconProps) => <LearningIcon {...props} name="crown" />;
export const Lightning = (props: IconProps) => <LearningIcon {...props} name="lightning" />;

export const Shield = (props: IconProps) => <LearningIcon {...props} name="shield" />;
