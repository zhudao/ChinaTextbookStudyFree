import { spawnSync } from "node:child_process";

// Windows often exposes a nonfunctional Microsoft Store alias as python3.
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, process.argv.slice(2), {
  stdio: "inherit",
  env: { ...process.env, PYTHONUTF8: "1" },
});
if (result.error) {
  console.error(`Cannot run ${python}: ${result.error.message}`);
}
process.exit(result.status ?? 1);
