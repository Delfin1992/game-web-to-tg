import { spawn } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5000";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/companies`);
      if (res.ok) return;
    } catch {
      // ignore until ready
    }
    await sleep(500);
  }
  throw new Error("Server did not become ready in time");
}

async function main() {
  const child = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "5000", NODE_ENV: "development" },
  });

  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));

  try {
    await waitForServer();

    const username = `smoke_${Date.now()}`;

    const regRes = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: "temp_pass",
        city: "Санкт-Петербург",
        personality: "workaholic",
        gender: "male",
      }),
    });

    if (!regRes.ok) throw new Error(`register failed: ${regRes.status}`);
    const user = await regRes.json();

    const companyRes = await fetch(`${BASE_URL}/api/company`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Smoke Company ${Date.now()}`,
        ownerId: user.id,
        username: user.username,
        city: "Санкт-Петербург",
      }),
    });

    if (!companyRes.ok) throw new Error(`create company failed: ${companyRes.status}`);

    const checks = [
      `${BASE_URL}/api/leaderboard/players?sort=level`,
      `${BASE_URL}/api/leaderboard/players?sort=reputation`,
      `${BASE_URL}/api/leaderboard/players?sort=wealth`,
      `${BASE_URL}/api/leaderboard/companies?sort=level`,
      `${BASE_URL}/api/leaderboard/companies?sort=wealth`,
      `${BASE_URL}/api/leaderboard/companies?sort=blueprints`,
      `${BASE_URL}/api/companies`,
      `${BASE_URL}/api/users/${user.id}`,
    ];

    for (const url of checks) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`check failed ${url}: ${res.status}`);
      await res.json();
    }

    console.log("✅ Smoke test passed (works with in-memory fallback when DB is unavailable)");
  } finally {
    child.kill("SIGINT");
    await sleep(300);
  }
}

main().catch((e) => {
  console.error("❌ Smoke test failed:", e);
  process.exit(1);
});
