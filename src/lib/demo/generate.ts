// Deterministic generator for FICTIONAL demo data.
//
// Every email uses the reserved example.com domain and every password is
// random gibberish — nothing here is, or resembles, a real credential.
// Shared by the offline demo database and `npm run db:seed` (Supabase).

export type DemoRole = "ADMIN" | "SUBMITTER";
export type DemoAccountType = "NEW" | "BOT" | "OLD";
export type DemoAccountStatus = "PENDING" | "SOLD" | "REJECTED";

export interface DemoUser {
  key: string;
  email: string;
  fullName: string;
  role: DemoRole;
  isActive: boolean;
  createdAt: Date;
}

export interface DemoEvent {
  action:
    | "CREATED"
    | "SUBMITTED"
    | "EDITED"
    | "TYPE_CHANGED"
    | "REJECTED"
    | "MARKED_SOLD"
    | "APPROVED"
    | "CREDENTIALS_REVEALED"
    | "CREDENTIALS_UPDATED";
  actorKey: string;
  at: Date;
  details: Record<string, unknown>;
}

export interface DemoAccount {
  submitterKey: string;
  type: DemoAccountType;
  status: DemoAccountStatus;
  loginEmail: string;
  loginPassword: string;
  ptcLogin: string | null;
  ptcPassword: string | null;
  notes: string | null;
  askingPrice: number | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  approvedByKey: string | null;
  rejectedAt: Date | null;
  rejectedByKey: string | null;
  soldAt: Date | null;
  soldByKey: string | null;
  salePrice: number | null;
  events: DemoEvent[];
}

export interface DemoNotification {
  userKey: string;
  accountIndex: number;
  kind: "REJECTED" | "SOLD" | "APPROVED";
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
}

export interface DemoGlobalEvent {
  action: "USER_ROLE_CHANGED" | "USER_DISABLED" | "EXPORTED";
  actorKey: string;
  targetKey: string | null;
  at: Date;
  details: Record<string, unknown>;
}

export interface DemoData {
  users: DemoUser[];
  accounts: DemoAccount[];
  notifications: DemoNotification[];
  globalEvents: DemoGlobalEvent[];
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "sparkrunner", "nightstroller", "citytrainer", "raidhunter", "stopspinner", "gymrookie",
  "mapwalker", "eggwalker", "lurehunter", "berrypicker", "starcatcher", "routerunner",
  "parkexplorer", "duskrider", "sunnytrainer", "frostcatcher", "thunderpaw", "mossyboots",
];

const NOTES = [
  "Level 31 · tutorial done",
  "Level 40 · 12 legendary catches",
  "Fresh account, no friends added",
  "Batch 7 · scripted farm",
  "2016 account · high stardust",
  "Region: EU · daily streak active",
  "Level 27 · 3 shiny catches",
  "Medals mostly gold",
  "Level 35 · raid pass stock",
  "Clean history, no strikes",
];

const REJECT_REASONS = ["Login failed during review", "Duplicate of an existing account", "Account flagged during check"];

export function generateDemoData(now: Date = new Date(), seed = 20261001): DemoData {
  const rand = mulberry32(seed);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const shuffle = <T,>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const gibberish = (length: number) => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
    return out;
  };
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  const users: DemoUser[] = [
    { key: "admin", email: "admin@example.com", fullName: "Alex Morgan", role: "ADMIN", isActive: true, createdAt: ago(320) },
    { key: "kai", email: "kai@example.com", fullName: "Kai Summers", role: "ADMIN", isActive: true, createdAt: ago(290) },
    { key: "riley", email: "submitter@example.com", fullName: "Riley Chen", role: "SUBMITTER", isActive: true, createdAt: ago(300) },
    { key: "jordan", email: "jordan@example.com", fullName: "Jordan Park", role: "SUBMITTER", isActive: true, createdAt: ago(280) },
    { key: "sam", email: "sam@example.com", fullName: "Sam Patel", role: "SUBMITTER", isActive: true, createdAt: ago(260) },
    { key: "taylor", email: "taylor@example.com", fullName: "Taylor Brooks", role: "SUBMITTER", isActive: true, createdAt: ago(210) },
    { key: "morgan", email: "morgan@example.com", fullName: "Morgan Lee", role: "SUBMITTER", isActive: true, createdAt: ago(180) },
    { key: "casey", email: "casey@example.com", fullName: "Casey Nguyen", role: "SUBMITTER", isActive: true, createdAt: ago(150) },
    { key: "jamie", email: "jamie@example.com", fullName: "Jamie Ortiz", role: "SUBMITTER", isActive: true, createdAt: ago(95) },
    { key: "drew", email: "drew@example.com", fullName: "Drew Walsh", role: "SUBMITTER", isActive: false, createdAt: ago(120) },
  ];
  const admins = ["admin", "kai"];
  const submitterWeights: [string, number][] = [
    ["riley", 46], ["jordan", 40], ["sam", 34], ["taylor", 30], ["morgan", 28],
    ["casey", 24], ["jamie", 14], ["drew", 9], ["admin", 15], ["kai", 10],
  ];
  const weightTotal = submitterWeights.reduce((sum, [, w]) => sum + w, 0);
  const pickSubmitter = () => {
    let roll = rand() * weightTotal;
    for (const [key, weight] of submitterWeights) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return "riley";
  };

  const types = shuffle([
    ...Array<DemoAccountType>(85).fill("NEW"),
    ...Array<DemoAccountType>(95).fill("BOT"),
    ...Array<DemoAccountType>(70).fill("OLD"),
  ]);
  const statuses = shuffle([
    ...Array<DemoAccountStatus>(70).fill("SOLD"),
    ...Array<DemoAccountStatus>(175).fill("PENDING"),
    ...Array<DemoAccountStatus>(5).fill("REJECTED"),
  ]);

  const usedEmails = new Set<string>();
  const usedPtc = new Set<string>();
  const accounts: DemoAccount[] = [];

  for (let i = 0; i < 250; i++) {
    const type = types[i];
    const status = statuses[i];
    let submitterKey = pickSubmitter();
    const user = users.find((u) => u.key === submitterKey)!;

    let loginEmail = "";
    do loginEmail = `${pick(WORDS)}${int(100, 999)}@example.com`;
    while (usedEmails.has(loginEmail));
    usedEmails.add(loginEmail);

    let ptcLogin: string | null = null;
    if (type === "BOT" || rand() < 0.8) {
      do ptcLogin = `demo_ptc_${pick(WORDS).slice(0, 8)}${int(10, 999)}`;
      while (usedPtc.has(ptcLogin));
      usedPtc.add(ptcLogin);
    }

    const accountAgeDays = status === "SOLD" ? rand() * 280 + 8 : rand() * 280 + 0.05;
    let createdAt = ago(accountAgeDays);
    if (createdAt < user.createdAt) {
      submitterKey = "riley";
      createdAt = new Date(Math.max(createdAt.getTime(), users[2].createdAt.getTime() + DAY));
    }
    const isAdminSubmission = admins.includes(submitterKey);
    const reviewer = pick(admins);
    const events: DemoEvent[] = [
      {
        action: isAdminSubmission ? "CREATED" : "SUBMITTED",
        actorKey: submitterKey,
        at: createdAt,
        details: { type },
      },
    ];

    let approvedAt: Date | null = null;
    let rejectedAt: Date | null = null;
    let soldAt: Date | null = null;
    let salePrice: number | null = null;

    if (status === "REJECTED") {
      rejectedAt = new Date(Math.min(createdAt.getTime() + rand() * 2 * DAY + HOUR, now.getTime() - HOUR));
      events.push({ action: "REJECTED", actorKey: reviewer, at: rejectedAt, details: { from: "PENDING", to: "REJECTED", reason: pick(REJECT_REASONS) } });
    }
    if (status === "SOLD") {
      // Direct sale: Pending → Sold. The sale also counts as the review.
      const maxGap = Math.max((now.getTime() - createdAt.getTime()) / DAY - 0.1, 0.1);
      soldAt = new Date(createdAt.getTime() + Math.min(rand() * 60 + 0.5, maxGap) * DAY);
      approvedAt = soldAt;
      salePrice = Math.round((type === "OLD" ? 35 + rand() * 60 : type === "BOT" ? 6 + rand() * 18 : 12 + rand() * 25) * 100) / 100;
      events.push({ action: "MARKED_SOLD", actorKey: reviewer, at: soldAt, details: { from: "PENDING", to: "SOLD" } });
    }

    if (approvedAt && rand() < 0.04) {
      const from: DemoAccountType = type === "NEW" ? "BOT" : "NEW";
      events.push({ action: "TYPE_CHANGED", actorKey: reviewer, at: new Date(approvedAt.getTime() - 30 * 60_000), details: { from, to: type } });
    }
    if (approvedAt && rand() < 0.05) {
      events.push({ action: "CREDENTIALS_REVEALED", actorKey: reviewer, at: new Date(approvedAt.getTime() + 20 * 60_000), details: { field: "login_password" } });
    }

    const lastEventAt = events.reduce((max, e) => (e.at > max ? e.at : max), createdAt);
    accounts.push({
      submitterKey,
      type,
      status,
      loginEmail,
      loginPassword: `Demo-${gibberish(10)}`,
      ptcLogin,
      ptcPassword: ptcLogin ? `Ptc-${gibberish(9)}` : null,
      notes: rand() < 0.35 ? pick(NOTES) : null,
      askingPrice: type === "NEW" ? Math.round((12 + rand() * 30) * 2) / 2 : null,
      createdAt,
      updatedAt: lastEventAt,
      approvedAt,
      approvedByKey: approvedAt ? reviewer : null,
      rejectedAt,
      rejectedByKey: rejectedAt ? reviewer : null,
      soldAt,
      soldByKey: soldAt ? reviewer : null,
      salePrice,
      events,
    });
  }

  accounts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Suppliers record their own sales and an admin approves them for the records.
  // The 20 most recent sales of active suppliers become supplier sales. Among the
  // 12 newest, two out of three still wait for approval (8 in total); every other
  // one was approved a few hours after the sale.
  // (No random numbers are drawn here, so the rest of the data set is unchanged.)
  const activeSuppliers = new Set(users.filter((u) => u.role === "SUBMITTER" && u.isActive).map((u) => u.key));
  const supplierSales = accounts
    .filter((a) => a.status === "SOLD" && a.soldAt && activeSuppliers.has(a.submitterKey))
    .sort((a, b) => b.soldAt!.getTime() - a.soldAt!.getTime())
    .slice(0, 20);
  supplierSales.forEach((account, rank) => {
    const approver = account.approvedByKey ?? admins[0];
    const sale = account.events.find((e) => e.action === "MARKED_SOLD");
    if (sale) sale.actorKey = account.submitterKey;
    account.soldByKey = account.submitterKey;
    if (rank < 12 && rank % 3 !== 0) {
      account.approvedAt = null;
      account.approvedByKey = null;
    } else {
      const approvedAt = new Date(Math.min(account.soldAt!.getTime() + (3 + (rank % 5) * 4) * HOUR, now.getTime() - 60_000));
      account.approvedAt = approvedAt;
      account.approvedByKey = approver;
      account.events.push({ action: "APPROVED", actorKey: approver, at: approvedAt, details: { sale: true } });
      if (approvedAt > account.updatedAt) account.updatedAt = approvedAt;
    }
  });

  const notifications: DemoNotification[] = [];
  accounts.forEach((account, index) => {
    if (admins.includes(account.submitterKey)) return;
    for (const event of account.events) {
      const ageDays = (now.getTime() - event.at.getTime()) / DAY;
      if (ageDays > 21) continue;
      const label = `#${String(index + 1).padStart(3, "0")}`;
      if (event.action === "REJECTED") {
        notifications.push({ userKey: account.submitterKey, accountIndex: index, kind: "REJECTED", title: `Account ${label} rejected`, body: `Reason: ${String(event.details.reason)}`, createdAt: event.at, read: ageDays > 4 });
      } else if (event.action === "MARKED_SOLD" && event.actorKey !== account.submitterKey) {
        // Suppliers are not notified about sales they recorded themselves.
        notifications.push({ userKey: account.submitterKey, accountIndex: index, kind: "SOLD", title: `Account ${label} sold`, body: "An account you submitted has been marked as sold.", createdAt: event.at, read: ageDays > 4 });
      } else if (event.action === "APPROVED") {
        notifications.push({ userKey: account.submitterKey, accountIndex: index, kind: "APPROVED", title: `Sale of ${label} approved`, body: "An admin approved the sale you recorded.", createdAt: event.at, read: ageDays > 4 });
      }
    }
  });

  const globalEvents: DemoGlobalEvent[] = [
    { action: "USER_ROLE_CHANGED", actorKey: "admin", targetKey: "kai", at: ago(288), details: { from: "SUBMITTER", to: "ADMIN" } },
    { action: "USER_DISABLED", actorKey: "admin", targetKey: "drew", at: ago(12), details: {} },
    { action: "EXPORTED", actorKey: "kai", targetKey: null, at: ago(3), details: { count: 160, with_passwords: false } },
  ];

  return { users, accounts, notifications, globalEvents };
}
