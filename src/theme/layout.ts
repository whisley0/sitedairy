/** Extra inset for bulky construction-site phone cases — keeps UI off the physical edge. */
export const FIELD_CASE_INSET = 14;

/** Standard inner padding for scrollable screen content. */
export const SCREEN_PADDING = 16;

export function fieldTabBarBottomInset(safeBottom: number): number {
  return Math.max(safeBottom, 8) + FIELD_CASE_INSET;
}

export function fieldHorizontalInset(safeLeft: number, safeRight: number) {
  return {
    paddingLeft: safeLeft + FIELD_CASE_INSET,
    paddingRight: safeRight + FIELD_CASE_INSET,
  };
}
