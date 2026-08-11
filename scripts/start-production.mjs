/**
 * Production start: free preferred port, fall back to next free port.
 * Usage: node scripts/start-production.mjs
 */
import { spawn, execSync } from "child_process";
import net from "net";

const PREFERRED = Number(process.env.PORT || 3000);
const FALLBACKS = [PREFERRED, PREFERRED + 1, PREFERRED + 2, 3001, 3002];

function killPort(port) {
  try {
    execSync(`npx --yes kill-port ${port}`, {
      stdio: "inherit",
      shell: true,
    });
  } catch {
    /* already free or kill-port unavailable */
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function pickPort() {
  const tried = new Set();
  for (const port of FALLBACKS) {
    if (tried.has(port)) continue;
    tried.add(port);
    killPort(port);
    // brief settle after kill
    await new Promise((r) => setTimeout(r, 400));
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `No free port among: ${[...tried].join(", ")}. Set PORT=... and retry.`
  );
}

const port = await pickPort();
console.log(`[Alnabiy] Starting Next.js on http://localhost:${port}`);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "-H", "0.0.0.0", "-p", String(port)],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: String(port) },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
