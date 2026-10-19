/** Motion shared by sheets, feedback and page entrances. */
export const uiMotion = {
  enter: { type: "spring" as const, damping: 28, stiffness: 360, mass: 0.8 },
  fade: { duration: 0.16, ease: "easeOut" as const },
};
