/** Posted monetary lines are rounded to whole shekels before later subtotals. */
export const roundShekels = (value: number): number =>
  value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5)

export const wholeUnits = (value: number): number => Math.round(value)
