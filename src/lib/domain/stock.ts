import type { PaymentStatus } from "./finance.ts";

export function desiredStockUsage(
  quantity: number,
  quantityPerUnit: number,
  status: PaymentStatus,
  deleted = false,
  voided = false,
): number {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    !Number.isFinite(quantityPerUnit) ||
    quantityPerUnit <= 0
  ) {
    throw new RangeError("invalid_quantity");
  }
  return status === "cancelled" || deleted || voided
    ? 0
    : Math.round(quantity * quantityPerUnit * 1000) / 1000;
}

export function stockAdjustment(previousUsage: number, desiredUsage: number): number {
  if (![previousUsage, desiredUsage].every((value) => Number.isFinite(value) && value >= 0))
    throw new RangeError("invalid_quantity");
  return Math.round((previousUsage - desiredUsage) * 1000) / 1000;
}

export function stockSummary(
  prepared: number | null,
  movementDeltas: readonly number[],
  threshold: number,
) {
  if (
    (prepared !== null && (!Number.isFinite(prepared) || prepared < 0)) ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    movementDeltas.some((value) => !Number.isFinite(value))
  )
    throw new RangeError("invalid_stock");
  const remaining =
    prepared === null
      ? null
      : Math.round((prepared + movementDeltas.reduce((sum, value) => sum + value, 0)) * 1000) /
        1000;
  const status =
    remaining === null
      ? "not_entered"
      : remaining <= 0
        ? "out"
        : remaining <= threshold
          ? "low"
          : "ok";
  return { remaining, status } as const;
}
