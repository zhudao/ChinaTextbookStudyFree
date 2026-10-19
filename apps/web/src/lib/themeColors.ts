/** Separate accent fills from readable labels and button foregrounds. */
function rgb(hex: string): number[] {
  return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}
function luminance(color: number[]): number {
  return color.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function contrast(a: number[], b: number[]): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function readableLabel(color: number[], dark: boolean): string {
  const surface = dark ? [55, 70, 79] : [229, 229, 229];
  for (let step = 0; step <= 20; step++) {
    const mixed = color.map(c => Math.round(c + ((dark ? 255 : 0) - c) * step / 20));
    if (contrast(mixed, surface) >= 5) return `rgb(${mixed.join(' ')})`;
  }
  return dark ? '#FFFFFF' : '#132C36';
}
export function themeAccentColors(primary: string, primaryDark: string, accent: string, dark: boolean): Record<string, string> {
  const fill = (hex: string) => {
    const darkRatio = contrast(rgb(hex), [7, 19, 23]);
    const lightRatio = contrast(rgb(hex), [255, 255, 255]);
    if (Math.max(darkRatio, lightRatio) < 4.5) return '#000000';
    return darkRatio >= lightRatio ? '#071317' : '#FFFFFF';
  };
  // Product fills are palette values, never contrast-adjusted text colors.
  // Measured Duolingo Web: owl #58CC02 / tree-frog #58A700, white label.
  // Keep readable small labels separate rather than darkening every control.
  const action = (hex: string, edge: string) => {
    return {
      bg: hex,
      ink: dark ? fill(hex) : '#FFFFFF',
      edge,
    };
  };
  const primaryAction = action(primary, primaryDark);
  const accentAction = action(accent, accent.toUpperCase() === '#1CB0F6' ? '#1899D6' : `rgb(${rgb(accent).map(c => Math.round(c * .82)).join(' ')})`);
  return {
    '--action-primary-bg': primaryAction.bg,
    '--action-primary-ink': primaryAction.ink,
    '--action-primary-edge': primaryAction.edge,
    '--action-accent-bg': accentAction.bg,
    '--action-accent-ink': accentAction.ink,
    '--action-accent-edge': accentAction.edge,
    '--theme-primary-rgb': rgb(primary).join(' '),
    '--theme-primary-dark-rgb': rgb(primaryDark).join(' '),
    '--theme-accent-rgb': rgb(accent).join(' '),
    '--theme-primary-ink': readableLabel(rgb(primary), dark),
    '--theme-accent-ink': readableLabel(rgb(accent), dark),
    '--theme-on-primary': fill(primary),
    '--theme-on-primary-dark': fill(primaryDark),
    '--theme-on-accent': fill(accent),
  };
}
