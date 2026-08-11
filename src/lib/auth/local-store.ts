import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { DEMO_STARTING_CREDITS } from "@/lib/credits";

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  alnabiyKey: string;
  coins: number;
  referralCode: string;
  status: "ACTIVE" | "WARNING" | "BANNED";
  createdAt: string;
}

interface StoreFile {
  users: LocalUser[];
}

function storePath() {
  const root = process.env.STORAGE_DIR || "./storage";
  return path.join(process.cwd(), root, "local-users.json");
}

function readStore(): StoreFile {
  const file = storePath();
  try {
    if (!existsSync(file)) return { users: [] };
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

function writeStore(data: StoreFile) {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyPassword(user: LocalUser, password: string): boolean {
  const next = hashPassword(password, user.salt);
  const a = Buffer.from(next, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Deterministik UUID — email dan, Prisma `@db.Uuid` ga mos */
export function localUserId(email: string): string {
  const h = createHash("sha256")
    .update(`alnabiy:${email.toLowerCase()}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function findUserByEmail(email: string): LocalUser | null {
  const e = email.toLowerCase();
  return readStore().users.find((u) => u.email === e) || null;
}

export function findUserById(id: string): LocalUser | null {
  return readStore().users.find((u) => u.id === id) || null;
}

export function findUserByKey(alnabiyKey: string): LocalUser | null {
  return readStore().users.find((u) => u.alnabiyKey === alnabiyKey) || null;
}

export function upsertLocalUser(opts: {
  email: string;
  password?: string;
  alnabiyKey?: string;
}): LocalUser {
  const store = readStore();
  const email = opts.email.toLowerCase();
  const existing = store.users.find((u) => u.email === email);

  if (existing) {
    if (opts.password) {
      const salt = randomBytes(16).toString("hex");
      existing.salt = salt;
      existing.passwordHash = hashPassword(opts.password, salt);
    }
    if (opts.alnabiyKey && opts.alnabiyKey.length >= 6) {
      existing.alnabiyKey = opts.alnabiyKey;
    }
    writeStore(store);
    return existing;
  }

  const salt = randomBytes(16).toString("hex");
  const password = opts.password || randomBytes(8).toString("hex");
  const user: LocalUser = {
    id: localUserId(email),
    email,
    salt,
    passwordHash: hashPassword(password, salt),
    alnabiyKey: opts.alnabiyKey || "aln_" + randomBytes(12).toString("hex"),
    coins: DEMO_STARTING_CREDITS,
    referralCode: "ALNABIY-" + randomBytes(3).toString("hex").toUpperCase(),
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  writeStore(store);
  return user;
}

export function updateLocalCoins(userId: string, coins: number): LocalUser | null {
  const store = readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  user.coins = coins;
  writeStore(store);
  return user;
}

export function publicUser(user: LocalUser) {
  return {
    id: user.id,
    email: user.email,
    alnabiyKey: user.alnabiyKey,
    alnabiy_key: user.alnabiyKey,
    coins: user.coins,
    alnabiyCoins: user.coins,
    referralCode: user.referralCode,
    status: user.status,
  };
}
