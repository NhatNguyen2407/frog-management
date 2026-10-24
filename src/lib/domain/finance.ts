export type PaymentStatus = "paid" | "unpaid" | "refunded" | "cancelled";

export interface SaleLine {
  quantity: number;
  unitPriceVnd: number;
  unitCostVnd: number | null;
  category: string;
  voided?: boolean;
}

export interface SaleOrder {
  status: PaymentStatus;
  deleted?: boolean;
  lines: readonly SaleLine[];
}

function money(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("invalid_money");
  return value;
}

function checkedSum(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw new RangeError("money_overflow");
  return total;
}

export function lineRevenue(line: SaleLine): number {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new RangeError("invalid_quantity");
  const total = line.quantity * money(line.unitPriceVnd);
  if (!Number.isSafeInteger(total)) throw new RangeError("money_overflow");
  return total;
}

export function paidLines(orders: readonly SaleOrder[]): SaleLine[] {
  return orders.filter(order => order.status === "paid" && !order.deleted)
    .flatMap(order => order.lines.filter(line => !line.voided));
}

export function subtotal(lines: readonly SaleLine[]): number { return checkedSum(lines.filter(line => !line.voided).map(lineRevenue)); }

export function revenue(orders: readonly SaleOrder[], category?: string): number {
  return checkedSum(paidLines(orders).filter(line => category === undefined || line.category === category).map(lineRevenue));
}

export function profitability(orders: readonly SaleOrder[], eventCostsVnd: number) {
  const lines = paidLines(orders);
  const revenueVnd = revenue(orders);
  const missingUnitCostCount = lines.filter(line => line.unitCostVnd === null).length;
  const knownCostOfGoodsVnd = checkedSum(lines.map(line => line.unitCostVnd === null ? 0
    : lineRevenue({ ...line, unitPriceVnd: money(line.unitCostVnd) })));
  const totalKnownCostsVnd = checkedSum([knownCostOfGoodsVnd, money(eventCostsVnd)]);
  const profitVnd = missingUnitCostCount ? null : revenueVnd - totalKnownCostsVnd;
  return {
    revenueVnd, knownCostOfGoodsVnd, totalKnownCostsVnd, missingUnitCostCount, profitVnd,
    marginPercent: profitVnd === null || revenueVnd === 0 ? null : profitVnd / revenueVnd * 100,
  };
}
