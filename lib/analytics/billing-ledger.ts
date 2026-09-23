import { generateDataset } from "@/lib/dataset/seed";

export type BillingLedgerRow = {
  id: string;
  name: string;
  segment: string;
  billedAt: string;
  billedOn: string;
  amount: number;
};

const customers = generateDataset();
export const BILLING_DEMO_AS_OF = "2026-09-22";
const months = [
  { year: 2025, month: 10 }, { year: 2025, month: 11 }, { year: 2025, month: 12 },
  ...Array.from({ length: 9 }, (_, index) => ({ year: 2026, month: index + 1 })),
];

/** A reproducible demo invoice-event ledger. Dates are synthetic, not inferred from MRR. */
export function billingLedgerForMonth(monthIndex: number): BillingLedgerRow[] {
  const month = months[monthIndex];
  if (!month) return [];
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
  return customers.flatMap((customer, index) => {
    const amount = customer.mrrHistory[monthIndex] ?? 0;
    if (amount <= 0) return [];
    const lastAvailableDay = monthIndex === 11 ? 22 : 28;
    const day = 1 + ((index * 17 + monthIndex * 5) % lastAvailableDay);
    const hour = 8 + ((index * 7) % 11);
    const minute = (index * 13) % 60;
    const date = new Date(Date.UTC(month.year, month.month - 1, day, hour, minute));
    return [{
      id: customer.id,
      name: customer.name,
      segment: customer.segment,
      billedAt: date.toISOString(),
      billedOn: formatter.format(date),
      amount,
    }];
  }).sort((a, b) => b.billedAt.localeCompare(a.billedAt) || a.id.localeCompare(b.id));
}
