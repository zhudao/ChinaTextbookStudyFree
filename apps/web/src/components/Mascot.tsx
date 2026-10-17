"use client";

import { motion, useAnimation, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { MascotSkinOverlay } from "./MascotSkinOverlay";
import { useProgressStore } from "@/store/progress";
import type { MascotMood, MascotReaction } from "@cstf/core";

export type { MascotMood, MascotReaction };
export interface MascotProps {
  mood?: MascotMood;
  size?: number;
  animate?: boolean;
  reactTo?: MascotReaction;
  reactKey?: number;
  /** Preview a wardrobe item without changing the equipped skin. */
  skinOverride?: string | null;
}

const CHARCOAL = "#292e2c";
const MOOD_LABELS: Record<MascotMood, string> = {
  happy: "开心", cheer: "欢呼", sad: "难过", think: "思考",
  wave: "招手", surprise: "惊喜", proud: "自豪", embarrassed: "害羞",
};
const IDLE = {
  breathe: {
    y: [0, -1.6, 0], scale: [1, 1.012, 1],
    transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const },
  },
  rest: { y: 0, scale: 1, transition: { duration: 0 } },
};

/**
 * Softly modelled SVG panda. Keep the existing accessory anchors:
 * eyes (45,48)/(75,48) and chest y=88; round the head above them.
 * Each instance owns its paint IDs, including the wardrobe's small previews.
 */
export function Mascot({
  mood = "happy", size = 120, animate = true, reactTo = null, reactKey = 0, skinOverride,
}: MascotProps) {
  const id = "panda-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const paint = (name: string) => "url(#" + id + "-" + name + ")";
  const reducedMotion = useReducedMotion();
  const canAnimate = animate && !reducedMotion;
  const reaction = useAnimation();
  const arm = useAnimation();
  const [blink, setBlink] = useState(false);
  const [sweat, setSweat] = useState(false);
  const [glow, setGlow] = useState(false);
  const equippedSkin = useProgressStore(s => s.equippedMascotSkin);
  const skinId = skinOverride !== undefined ? skinOverride : equippedSkin;

  useEffect(() => {
    setBlink(false);
    if (!canAnimate || !["happy", "think", "wave"].includes(mood)) return;
    let next: ReturnType<typeof setTimeout>;
    let reopen: ReturnType<typeof setTimeout>;
    const schedule = () => {
      next = setTimeout(() => {
        setBlink(true);
        reopen = setTimeout(() => setBlink(false), 135);
        schedule();
      }, 3200 + Math.random() * 2200);
    };
    schedule();
    return () => { clearTimeout(next); clearTimeout(reopen); };
  }, [canAnimate, mood]);

  useEffect(() => {
    reaction.set({ x: 0, y: 0, rotate: 0, scale: 1 });
    arm.set({ rotate: 0 });
    setSweat(false);
    setGlow(false);
    if (!canAnimate || !reactTo) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (reactTo === "correct") {
      void reaction.start({
        scale: [1, 1.08, 0.99, 1], y: [0, -4, 0],
        transition: { duration: 0.52, ease: "easeOut" },
      });
      void arm.start({ rotate: [0, -24, 0, -14, 0], transition: { duration: 0.6 } });
    } else if (reactTo === "wrong") {
      void reaction.start({ rotate: [0, -5, 5, -3, 3, 0], transition: { duration: 0.5 } });
      setSweat(true);
      timer = setTimeout(() => setSweat(false), 1150);
    } else if (reactTo === "levelup") {
      void reaction.start({
        y: [0, -12, 0, -4, 0], scale: [1, 1.05, 1],
        transition: { duration: 0.85, ease: "easeOut" },
      });
      void arm.start({ rotate: [0, -28, 0, -22, 0], transition: { duration: 0.85 } });
      setGlow(true);
      timer = setTimeout(() => setGlow(false), 1400);
    }
    return () => {
      clearTimeout(timer);
      reaction.stop();
      arm.stop();
    };
  }, [canAnimate, reactTo, reactKey, reaction, arm]);

  return (
    <div style={{ width: size, height: size, position: "relative", display: "inline-block", flexShrink: 0 }}>
      {glow && <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: [0, 0.65, 0], scale: [0.75, 1.3, 1.5] }}
        transition={{ duration: 1.35 }}
        style={{
          position: "absolute", inset: "-16%", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, #ffdc7b66, #ffdc7b00 70%)",
        }}
      />}
      <svg width={size} height={size} viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby={id + "-title"}
        style={{ display: "block", overflow: "visible" }}>
        <title id={id + "-title"}>{"聪聪，" + MOOD_LABELS[mood]}</title>
        <PandaPaint id={id} />
        <ellipse cx="60" cy="118.5" rx="28" ry="2.2" fill={paint("ground")} />
        {/* Initial transforms let SVG groups measure before Framer animates them.
            Breathing stays independent of answer reactions. */}
        <motion.g initial={{ x: 0, y: 0, scale: 1 }} variants={IDLE} animate={canAnimate ? "breathe" : "rest"}
          style={{ originX: "60px", originY: "105px" }}>
          <motion.g initial={{ x: 0, y: 0, rotate: 0, scale: 1 }} animate={reaction} style={{ originX: "60px", originY: "85px" }}>
            <ellipse cx="60" cy="85" rx="30.5" ry="28" fill={paint("body")} />
            <ellipse cx="61" cy="89" rx="21" ry="20" fill={paint("belly")} />
            <path d="M43 103 Q60 112 77 103" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1" />
            <g transform={mood === "wave" ? "translate(-11 -23) rotate(-28 23 80)" : undefined}>
              <motion.g initial={{ rotate: 0 }} animate={arm} style={{ originX: "25px", originY: "77px" }}>
                <ellipse cx="23" cy="80" rx="9.3" ry="15" transform="rotate(12 23 80)" fill={paint("dark")} />
                <path d="M20 69 Q16 72 16.5 78" fill="none" stroke="#929b94" strokeOpacity=".2" strokeWidth="1.6" strokeLinecap="round" />
              </motion.g>
            </g>
            <ellipse cx="97" cy="80" rx="9.3" ry="15" transform="rotate(-12 97 80)" fill={paint("dark")} />
            <path d="M97 69 Q103 73 103 79" fill="none" stroke="#929b94" strokeOpacity=".16" strokeWidth="1.6" strokeLinecap="round" />
            <ellipse cx="60" cy="82.5" rx="23" ry="4.5" fill={paint("ground")} />
            <Paw x={43.5} angle={-12} fill={paint("dark")} />
            <Paw x={76.5} angle={12} fill={paint("dark")} />
            <circle cx="32" cy="21" r="12.8" fill={paint("dark")} />
            <circle cx="88" cy="21" r="12.8" fill={paint("dark")} />
            <ellipse cx="32.5" cy="21.5" rx="7.7" ry="8" fill="#161c18" opacity=".25" />
            <ellipse cx="87.5" cy="21.5" rx="7.7" ry="8" fill="#161c18" opacity=".25" />
            <path d="M23 16 Q27 9 34 10 M80 12 Q86 8 92 12" fill="none"
              stroke="#a5aca7" strokeOpacity=".19" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="60" cy="46" rx="42" ry="36" fill={paint("head")} stroke="#dce2dc" strokeWidth=".45" />
            <ellipse cx="53" cy="25" rx="24" ry="13" fill={paint("forehead")} />
            <ellipse cx="60" cy="65" rx="23" ry="15" fill={paint("muzzle")} />
            <ellipse cx="43.5" cy="49.8" rx="12.4" ry="15.6" transform="rotate(13 43.5 49.8)" fill={paint("patch")} />
            <ellipse cx="76.5" cy="49.8" rx="12.4" ry="15.6" transform="rotate(-13 76.5 49.8)" fill={paint("patch")} />
            <ellipse cx="44.8" cy="47.8" rx="8.4" ry="8.8" fill={paint("eye")} />
            <ellipse cx="75.2" cy="47.8" rx="8.4" ry="8.8" fill={paint("eye")} />
            <Eyes mood={mood} blink={blink} fill={paint("pupil")} />
            <path d="M53.5 60.3 Q60 57.7 66.5 60.3 Q66 66.2 60 68 Q54 66.2 53.5 60.3Z" fill={paint("nose")} />
            <ellipse cx="58.5" cy="60.6" rx="2.6" ry=".8" fill="#ffffff" opacity=".2" />
            <Mouth mood={mood} />
            {mood === "embarrassed" && <>
              <ellipse cx="31" cy="63" rx="6.2" ry="3.7" fill={paint("blush")} />
              <ellipse cx="89" cy="63" rx="6.2" ry="3.7" fill={paint("blush")} />
            </>}
            {sweat && <motion.path d="M98 28 Q102 35 98 39 Q94 35 98 28Z"
              initial={{ opacity: 0, y: -3 }} animate={{ opacity: [0, 1, 1, 0], y: [-3, 1, 7, 12] }}
              transition={{ duration: 1.1 }} fill="#9ed8ec" stroke="#72b4d1" strokeWidth=".7" />}
            <MascotSkinOverlay skinId={skinId} />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}

function PandaPaint({ id }: { id: string }) {
  const tones = {
    head: ["#fffefb", "#fafaf7", "#d4d7d2"],
    body: ["#fffefa", "#eef1ec", "#cbd5cd"],
    belly: ["#fffefa", "#f8faf5", "#e6ece4"],
    dark: ["#545553", "#343734", "#202522"],
    patch: ["#454d46", "#2c342e", "#222923"],
    eye: ["#ffffff", "#f9faf6", "#dce3db"],
    pupil: ["#515a51", "#2d362f", "#1d271f"],
  };
  return <defs>
    {Object.entries(tones).map(([name, colors]) => <radialGradient key={name}
      id={id + "-" + name} cx="35%" cy="25%" r="80%">
      <stop stopColor={colors[0]} /><stop offset=".6" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} />
    </radialGradient>)}
    <linearGradient id={id + "-nose"} x1="0" y1="0" x2=".6" y2="1">
      <stop stopColor="#4c544e" /><stop offset="1" stopColor="#252c27" />
    </linearGradient>
    <radialGradient id={id + "-forehead"}>
      <stop stopColor="#ffffff" stopOpacity=".45" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={id + "-muzzle"}>
      <stop stopColor="#ffffff" stopOpacity=".6" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={id + "-ground"}>
      <stop stopColor="#203629" stopOpacity=".18" /><stop offset="1" stopColor="#203629" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={id + "-blush"}>
      <stop stopColor="#efafad" stopOpacity=".65" /><stop offset="1" stopColor="#efafad" stopOpacity="0" />
    </radialGradient>
  </defs>;
}

function Paw({ x, angle, fill }: { x: number; angle: number; fill: string }) {
  return <g transform={"rotate(" + angle + " " + x + " 109)"}>
    <ellipse cx={x} cy="109" rx="12" ry="9.5" fill={fill} />
    <ellipse cx={x} cy="111" rx="4.8" ry="3.4" fill="#626d63" opacity=".72" />
    {[-5, 0, 5].map((dx, i) => <ellipse key={dx} cx={x + dx} cy={i === 1 ? 104 : 105.3}
      rx="1.8" ry="1.7" fill="#7b867c" opacity=".65" />)}
  </g>;
}

function Eyes({ mood, blink, fill }: { mood: MascotMood; blink: boolean; fill: string }) {
  const closed = blink && ["happy", "think", "wave"].includes(mood);
  const eye = (x: number, y: number, r = 5.1, proud = false) => <g key={x}>
    <ellipse cx={x} cy={y} rx={r} ry={r + .35} fill={fill} />
    <circle cx={x + 1.3} cy={y - 1.7} r={proud ? 1.8 : 1.55} fill="#ffffff" />
    <circle cx={x - 1.7} cy={y + 2.1} r=".65" fill="#ffffff" opacity=".55" />
  </g>;
  const lid = (x: number, cheerful = false) => <path key={x}
    d={cheerful ? "M" + (x - 5.8) + " 49 Q" + x + " 41.5 " + (x + 5.8) + " 49"
      : "M" + (x - 6.1) + " 48 Q" + x + " 51 " + (x + 6.1) + " 48"}
    stroke={CHARCOAL} strokeWidth="2.1" fill="none" strokeLinecap="round" />;
  if (closed) return <>{lid(44.8)}{lid(75.2)}</>;
  if (mood === "cheer") return <>{lid(44.8, true)}{lid(75.2, true)}</>;
  if (mood === "think") return <>{eye(44.8, 47.8)}{lid(75.2)}</>;
  if (mood === "sad") return <>{eye(44.8, 50, 4.3)}{eye(75.2, 50, 4.3)}
    <path d="M33 35 Q41 36 49 39 M87 35 Q79 36 71 39" fill="none"
      stroke={CHARCOAL} strokeWidth="1.9" strokeLinecap="round" /></>;
  if (mood === "surprise") return <>{eye(44.8, 47.8, 6.5)}{eye(75.2, 47.8, 6.5)}</>;
  if (mood === "proud") return <>{eye(44.8, 47.8, 5.1, true)}{eye(75.2, 47.8, 5.1, true)}
    <path d="M33 37 Q41 32 49 37 M87 37 Q79 32 71 37" fill="none"
      stroke={CHARCOAL} strokeWidth="1.8" strokeLinecap="round" /></>;
  if (mood === "embarrassed") return <>{eye(46, 49.5, 4.2)}{eye(76.5, 49.5, 4.2)}</>;
  return <>{eye(44.8, 47.8)}{eye(75.2, 47.8)}</>;
}

function Mouth({ mood }: { mood: MascotMood }) {
  if (mood === "surprise") return <ellipse cx="60" cy="73" rx="3" ry="4" fill={CHARCOAL} />;
  if (mood === "sad") return <path d="M54 74 Q60 68 66 74" stroke={CHARCOAL}
    strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  if (mood === "cheer") return <g>
    <path d="M52.5 69.5 Q60 73 67.5 69.5 Q66 78.5 60 78.5 Q54 78.5 52.5 69.5Z" fill={CHARCOAL} />
    <path d="M56 76.5 Q60 73.5 64 76.5 Q60 79 56 76.5" fill="#dc9d9b" />
  </g>;
  return <path d="M60 67.5 V71 Q64 75 68 72.5 M60 71 Q56 75 52 72.5"
    fill="none" stroke={CHARCOAL} strokeWidth="1.8" strokeLinecap="round" />;
}
