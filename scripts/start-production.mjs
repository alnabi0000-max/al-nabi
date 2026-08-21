/**
 * Production start: require a passing preflight and an unused requested port.
 * Usage: node scripts/start-production.mjs
 */
import { spawn, spawnSync } from "child_process";
import net from "net";
import path from "path";

function requestedPort() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT || ""}`);
  }
  return port;
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

function runPreflight() {
  const root = process.cwd();
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(root, "scripts", "launch-check.ts"),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    }
  );
  if (result.error) {
    throw new Error(
      `Could not run the launch preflight: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPreflight();

const port = requestedPort();
if (!(await isPortFree(port))) {
  throw new Error(
    `PORT ${port} is already in use. Refusing to stop or replace an existing process.`
  );
}

console.log(`[Alnabiy] Starting Next.js on http://localhost:${port}`);

const child = spawn(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    "start",
    "-H",
    "0.0.0.0",
    "-p",
    String(port),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
