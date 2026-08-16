import { hash, compare } from "bcryptjs";

function bcryptRounds(): number {
  if (process.env.NODE_ENV === "test") return 4;
  return 12;
}

let dummyHashPromise: Promise<string> | null = null;

function dummyHash(): Promise<string> {
  dummyHashPromise ??= hash("alnabiy-dummy-not-a-real-passcode", bcryptRounds());
  return dummyHashPromise;
}

export async function hashPasscode(passcode: string): Promise<string> {
  return hash(passcode, bcryptRounds());
}

/**
 * Constant-time-ish verify: always runs bcrypt against a real hash, even when
 * no settings row exists, so missing configuration does not leak via timing.
 */
export async function verifyPasscodeHash(
  passcode: string,
  passcodeHash: string | null | undefined
): Promise<boolean> {
  const usable = Boolean(passcodeHash && passcodeHash.startsWith("$2"));
  const target = usable ? passcodeHash! : await dummyHash();
  try {
    const matched = await compare(passcode, target);
    return usable && matched;
  } catch {
    try {
      await compare(passcode, await dummyHash());
    } catch {
      /* ignore */
    }
    return false;
  }
}
