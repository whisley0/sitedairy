/** Typography scales for simplified vs complete UI modes. */
export const typographySimplified = {
  xs: 12,
  sm: 14,
  body: 17,
  md: 18,
  lg: 20,
  xl: 22,
  cardTitle: 28,
  headline: 30,
  title: 36,
  lineHeight: {
    body: 24,
    relaxed: 26,
    cardTitle: 34,
    title: 42,
  },
} as const;

export const typographyComplete = {
  xs: 11,
  sm: 13,
  body: 15,
  md: 16,
  lg: 17,
  xl: 20,
  cardTitle: 16,
  headline: 18,
  title: 22,
  lineHeight: {
    body: 22,
    relaxed: 24,
    cardTitle: 22,
    title: 28,
  },
} as const;

export type AppTypography = typeof typographySimplified | typeof typographyComplete;

/** @deprecated Use useAppTypography() for mode-aware sizes. */
export const typography = typographySimplified;
