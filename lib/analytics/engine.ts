import { generateDataset, MONTHS } from "@/lib/dataset/seed";
import type { AnalyticsSnapshot, ChartDatum, Customer } from "@/types/analytics";

const currency = (value: number) => Math.round(value);
const pct = (current: number, previous: number) => previous === 0 ? 0 : ((current - previous) / previous) * 100;

function sumAt(customers: Customer[], month: number) {
  return customers.reduce((sum, customer) => sum + customer.mrrHistory[month], 0);
}

function grouped(customers: Customer[], key: "plan" | "country" | "segment" | "source"): ChartDatum[] {
  const map = new Map<string, number>();
  for (const customer of customers) {
    map.set(customer[key], (map.get(customer[key]) ?? 0) + customer.mrrHistory[11]);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: currency(value) }))
    .sort((a, b) => Number(b.value) - Number(a.value));
}

export function calculateAnalytics(customers = generateDataset()): AnalyticsSnapshot {
  const revenueHistory = MONTHS.map((month, index) => ({ month, revenue: currency(sumAt(customers, index)) }));
  const current = sumAt(customers, 11);
  const previous = sumAt(customers, 10);
  const enterprise = customers.filter((customer) => customer.segment === "Enterprise");
  const enterpriseCurrent = sumAt(enterprise, 11);
  const enterprisePrevious = sumAt(enterprise, 10);
  const decliners = [...customers]
    .map((customer) => ({
      id: customer.id,
      customer: customer.name,
      segment: customer.segment,
      previous: customer.mrrHistory[10],
      current: customer.mrrHistory[11],
      decline: customer.mrrHistory[11] - customer.mrrHistory[10],
      failed: customer.failedPayments,
      status: customer.status === "past_due" ? "Payment risk" : customer.status === "canceled" ? "Canceled" : "Contracted",
    }))
    .filter((row) => row.decline < 0)
    .sort((a, b) => a.decline - b.decline);
  const enterpriseDecliners = decliners.filter((row) => row.segment === "Enterprise").slice(0, 8);
  const active = customers.filter((customer) => customer.status !== "canceled").length;
  const atRisk = customers.filter((customer) => customer.status === "past_due" || customer.failedPayments > 0).length;
  const canceled = customers.filter((customer) => customer.status === "canceled").length;
  const newThisMonth = customers.filter((customer) => customer.joinedMonth === 11).length;
  const acme = customers.find((customer) => customer.id === "acme")!;
  const peers = enterprise
    .filter((customer) => customer.id !== "acme" && customer.status !== "canceled")
    .sort((a, b) => Math.abs(a.mrrHistory[10] - acme.mrrHistory[10]) - Math.abs(b.mrrHistory[10] - acme.mrrHistory[10]))
    .slice(0, 4);
  const acquisitionFunnel = [
    { stage: "Visitors", value: 48200 },
    { stage: "Sign-ups", value: 6820 },
    { stage: "Activated", value: 4210 },
    { stage: "Trials", value: 1920 },
    { stage: "Customers", value: 405 },
  ];
  const dailyCash = Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    const weekday = index % 7;
    const subscriptions = Math.round(23800 + Math.sin(index * 0.72) * 4300 + (weekday < 5 ? 3100 : -5200));
    const invoices = Math.round(7800 + Math.cos(index * 0.48) * 2600 + (day === 1 || day === 15 ? 9500 : 0));
    const refunds = Math.max(450, Math.round(1250 + Math.sin(index * 1.14) * 620));
    const operatingOut = Math.round(14600 + Math.cos(index * 0.31) * 2100 + (day % 7 === 5 ? 4200 : 0));
    return {
      day: `Sep ${String(day).padStart(2, "0")}`,
      cashIn: subscriptions + invoices,
      subscriptions,
      invoices,
      refunds,
      cashOut: operatingOut + refunds,
      netCash: subscriptions + invoices - operatingOut - refunds,
      newCustomers: 7 + ((index * 7) % 13),
      failedPayments: 1 + ((index * 5) % 6),
    };
  });
  const totalIn = dailyCash.reduce((sum, row) => sum + row.cashIn, 0);
  const totalOut = dailyCash.reduce((sum, row) => sum + row.cashOut, 0);

  return {
    months: MONTHS,
    cashflow: {
      daily: dailyCash,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      averageDaily: Math.round(totalIn / dailyCash.length),
    },
    revenue: {
      current: currency(current),
      previous: currency(previous),
      delta: pct(current, previous),
      history: revenueHistory,
      byPlan: grouped(customers, "plan"),
      byCountry: grouped(customers, "country"),
      bySegment: grouped(customers, "segment"),
      movement: [
        { name: "Starting MRR", value: currency(previous) },
        { name: "Expansion", value: 28400 },
        { name: "New", value: 19200 },
        { name: "Contraction", value: -22600 },
        { name: "Churn", value: currency(current - previous - 25000) },
      ],
    },
    customers: {
      total: customers.length,
      active,
      newThisMonth,
      atRisk,
      top: [...customers]
        .sort((a, b) => b.mrrHistory[11] - a.mrrHistory[11])
        .slice(0, 8)
        .map((customer) => ({ id: customer.id, customer: customer.name, segment: customer.segment, mrr: customer.mrrHistory[11], status: customer.status })),
      decliners: decliners.slice(0, 10),
    },
    retention: {
      churnRate: (canceled / customers.length) * 100,
      netRetention: 96.7,
      history: MONTHS.map((month, index) => ({ month, churn: Number((3.2 + Math.sin(index / 2) * 0.7 + (index === 11 ? 1.1 : 0)).toFixed(1)), nrr: Number((101.5 - index * 0.22 - (index === 11 ? 2.4 : 0)).toFixed(1)) })),
      cohorts: [
        { cohort: "Apr", m1: 100, m3: 91, m6: 84 },
        { cohort: "May", m1: 100, m3: 93, m6: 86 },
        { cohort: "Jun", m1: 100, m3: 90, m6: 0 },
        { cohort: "Jul", m1: 100, m3: 94, m6: 0 },
        { cohort: "Aug", m1: 100, m3: 0, m6: 0 },
      ],
    },
    acquisition: {
      conversion: (405 / 48200) * 100,
      funnel: acquisitionFunnel,
      bySource: grouped(customers, "source").map((item) => ({ name: item.name, customers: Math.max(40, Math.round(Number(item.value) / 270)) })),
    },
    enterprise: {
      current: currency(enterpriseCurrent),
      previous: currency(enterprisePrevious),
      delta: pct(enterpriseCurrent, enterprisePrevious),
      history: MONTHS.map((month, index) => ({ month, revenue: currency(sumAt(enterprise, index)) })),
      losses: [
        { name: "Cancellations", value: Math.abs(enterpriseDecliners.filter((row) => row.status === "Canceled").reduce((sum, row) => sum + row.decline, 0)) },
        { name: "Contraction", value: Math.abs(enterpriseDecliners.filter((row) => row.status === "Contracted").reduce((sum, row) => sum + row.decline, 0)) },
        { name: "Payment risk", value: Math.abs(enterpriseDecliners.filter((row) => row.status === "Payment risk").reduce((sum, row) => sum + row.decline, 0)) },
      ],
      customers: enterpriseDecliners,
    },
    acme: {
      id: acme.id,
      name: acme.name,
      mrr: acme.mrrHistory[11],
      previousMrr: acme.mrrHistory[10],
      arr: acme.mrrHistory[11] * 12,
      usageDelta: pct(acme.usageHistory[11], acme.usageHistory[10]),
      failedPayments: acme.failedPayments,
      seats: acme.seats,
      previousSeats: acme.previousSeats,
      risk: "High risk",
      revenueHistory: MONTHS.map((month, index) => ({ month, revenue: acme.mrrHistory[index] })),
      usageHistory: MONTHS.map((month, index) => ({ month, usage: acme.usageHistory[index] })),
      payments: [
        { date: "Sep 18", amount: "$4,200", status: "Failed", method: "Visa •••• 0182" },
        { date: "Sep 11", amount: "$4,200", status: "Failed", method: "Visa •••• 0182" },
        { date: "Sep 04", amount: "$7,100", status: "Failed", method: "Visa •••• 0182" },
        { date: "Aug 01", amount: "$7,100", status: "Paid", method: "ACH •••• 2291" },
      ],
      timeline: [
        { date: "Sep 18", title: "Payment retry failed", detail: "Third failed attempt this month" },
        { date: "Sep 12", title: "58 seats removed", detail: "Contract changed from 142 to 84 seats" },
        { date: "Sep 09", title: "Usage alert", detail: "Weekly active usage fell below 60%" },
        { date: "Aug 27", title: "Support escalation", detail: "SSO provisioning issue opened" },
      ],
      comparison: [acme, ...peers].map((customer) => ({
        customer: customer.name,
        mrr: customer.mrrHistory[11],
        change: Number(pct(customer.mrrHistory[11], customer.mrrHistory[10]).toFixed(1)),
        usage: customer.usageHistory[11],
        failed: customer.failedPayments,
        seats: customer.seats,
      })),
    },
  };
}

export const analytics = calculateAnalytics();
