import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const container = "frog-operations-phase1-tests";
const docker = (args, options = {}) => {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
};
try {
  try {
    docker(["inspect", container]);
  } catch {
    docker([
      "run",
      "--pull=never",
      "--name",
      container,
      "--network",
      "none",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-d",
      "postgres:17",
    ]);
  }
  docker(["start", container]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(["exec", container, "pg_isready", "-U", "postgres"]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Local test database did not become ready.");
  const migrations = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const sources = await Promise.all(
    migrations.map((name) => readFile(`supabase/migrations/${name}`, "utf8")),
  );
  const sql = [
    "begin;",
    await readFile("tests/database/bootstrap.sql", "utf8"),
    ...sources.map((source) => source.replace(/^\s*(begin|commit);\s*$/gim, "")),
    (await readFile("supabase/seed.sql", "utf8")).replace(/^\s*(begin|commit);\s*$/gim, ""),
    await readFile("tests/database/phase1.sql", "utf8"),
    "rollback;",
  ].join("\n");
  const output = docker(
    ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql },
  );
  console.log(output.trim().split("\n").slice(-8).join("\n"));
  console.log(
    "Database schema and permission assertions passed; all test changes were rolled back.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    docker(["stop", container]);
  } catch {
    /* Do not hide the original failure. */
  }
}
