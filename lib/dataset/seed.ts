import type { Customer } from "@/types/analytics";

export const MONTHS = [
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26",
  "Jun 26",
  "Jul 26",
  "Aug 26",
  "Sep 26",
];

const FIRST_NAMES = [
  "Northstar",
  "Meridian",
  "Helix",
  "Atlas",
  "Lattice",
  "Juniper",
  "Cinder",
  "Beacon",
  "Orbit",
  "Vector",
  "Summit",
  "Kinetic",
];

const SUFFIXES = ["Labs", "Systems", "Group", "Cloud", "Works", "AI", "Health", "Commerce"];
const COUNTRIES = ["United States", "United Kingdom", "Germany", "Canada", "Brazil", "France"];
const SOURCES = ["Organic", "Partner", "Paid search", "Referral", "Outbound"];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intentionalCustomers(): Customer[] {
  return [
    {
      id: "acme",
      name: "Acme Corp",
      segment: "Enterprise",
      plan: "Scale",
      country: "United States",
      source: "Outbound",
      status: "past_due",
      joinedMonth: 0,
      seats: 84,
      previousSeats: 142,
      failedPayments: 3,
      mrrHistory: [6200, 6400, 6600, 6800, 7000, 7200, 7350, 7500, 7400, 7250, 7100, 4200],
      usageHistory: [92, 95, 98, 101, 105, 108, 110, 106, 102, 96, 91, 53],
      supportTickets: 4,
    },
    {
      id: "northstar",
      name: "Northstar Labs",
      segment: "Enterprise",
      plan: "Scale",
      country: "United States",
      source: "Partner",
      status: "active",
      joinedMonth: 0,
      seats: 120,
      previousSeats: 155,
      failedPayments: 0,
      mrrHistory: [7600, 7700, 7800, 8100, 8300, 8400, 8500, 8600, 8700, 8800, 8900, 7100],
      usageHistory: [110, 112, 115, 118, 120, 124, 126, 125, 121, 118, 116, 96],
      supportTickets: 2,
    },
    {
      id: "meridian",
      name: "Meridian Systems",
      segment: "Enterprise",
      plan: "Scale",
      country: "Germany",
      source: "Outbound",
      status: "canceled",
      joinedMonth: 0,
      seats: 0,
      previousSeats: 90,
      failedPayments: 2,
      mrrHistory: [4800, 4900, 5000, 5100, 5200, 5300, 5400, 5450, 5500, 5500, 5400, 0],
      usageHistory: [72, 74, 76, 77, 79, 81, 80, 76, 68, 55, 34, 0],
      supportTickets: 6,
    },
    {
      id: "helix",
      name: "Helix Health",
      segment: "Enterprise",
      plan: "Scale",
      country: "United Kingdom",
      source: "Partner",
      status: "past_due",
      joinedMonth: 1,
      seats: 78,
      previousSeats: 96,
      failedPayments: 2,
      mrrHistory: [0, 3900, 4050, 4200, 4300, 4400, 4500, 4600, 4650, 4700, 4750, 3600],
      usageHistory: [0, 55, 59, 64, 68, 72, 74, 77, 75, 73, 70, 52],
      supportTickets: 5,
    },
    {
      id: "atlas",
      name: "Atlas Commerce",
      segment: "Enterprise",
      plan: "Scale",
      country: "Canada",
      source: "Organic",
      status: "active",
      joinedMonth: 0,
      seats: 135,
      previousSeats: 128,
      failedPayments: 0,
      mrrHistory: [6500, 6600, 6750, 6900, 7100, 7250, 7400, 7600, 7750, 7900, 8100, 8350],
      usageHistory: [88, 90, 94, 96, 99, 101, 104, 107, 111, 115, 118, 124],
      supportTickets: 1,
    },
  ];
}

export function generateDataset(seed = 20260921, size = 2481): Customer[] {
  const random = mulberry32(seed);
  const customers = intentionalCustomers();

  for (let index = customers.length; index < size; index += 1) {
    const roll = random();
    const segment = roll < 0.035 ? "Enterprise" : roll < 0.16 ? "Growth" : roll < 0.47 ? "Pro" : "Starter";
    const plan = segment === "Enterprise" ? "Scale" : segment;
    const base = segment === "Enterprise" ? 2600 + random() * 3200 : segment === "Growth" ? 560 + random() * 800 : segment === "Pro" ? 180 + random() * 300 : 38 + random() * 95;
    const joinedMonth = Math.floor(random() * 10);
    const trend = (random() - 0.34) * 0.035;
    const history = MONTHS.map((_, month) => {
      if (month < joinedMonth) return 0;
      const seasonality = 1 + Math.sin((month / 12) * Math.PI * 2) * 0.025;
      const value = base * (1 + trend * (month - joinedMonth)) * seasonality;
      return Math.max(0, Math.round(value / 5) * 5);
    });
    const isCanceled = random() < 0.018;
    const isPastDue = !isCanceled && random() < 0.042;
    if (isCanceled) history[11] = 0;
    if (segment === "Enterprise" && random() < 0.22) history[11] = Math.round(history[10] * (0.82 + random() * 0.1));
    const usageBase = 18 + random() * 85;
    const usageHistory = MONTHS.map((_, month) => (month < joinedMonth ? 0 : Math.max(0, Math.round(usageBase * (1 + trend * month * 1.8)))));
    const previousSeats = Math.max(2, Math.round(base / (segment === "Enterprise" ? 42 : 18)));
    const seats = isCanceled ? 0 : Math.max(1, Math.round(previousSeats * (history[11] / Math.max(1, history[10]))));
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const suffix = SUFFIXES[Math.floor(index / FIRST_NAMES.length) % SUFFIXES.length];
    customers.push({
      id: `customer-${index + 1}`,
      name: `${first} ${suffix} ${String(index + 1).padStart(4, "0")}`,
      segment,
      plan,
      country: COUNTRIES[Math.floor(random() * COUNTRIES.length)],
      source: SOURCES[Math.floor(random() * SOURCES.length)],
      status: isCanceled ? "canceled" : isPastDue ? "past_due" : "active",
      joinedMonth,
      seats,
      previousSeats,
      failedPayments: isPastDue ? 1 + Math.floor(random() * 3) : 0,
      mrrHistory: history,
      usageHistory,
      supportTickets: Math.floor(random() * (isPastDue ? 7 : 3)),
    });
  }

  return customers;
}
