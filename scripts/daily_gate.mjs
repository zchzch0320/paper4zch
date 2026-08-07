import { appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beijingDateKey, shouldRefreshToday } from "./cloud_refresh.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = JSON.parse(await readFile(resolve(projectRoot, "public", "recommendations.json"), "utf8"));
const scheduled = process.env.GITHUB_EVENT_NAME === "schedule";
const shouldRun = !scheduled || shouldRefreshToday(digest, new Date());
const message = shouldRun
  ? `Refresh enabled for Beijing date ${beijingDateKey(new Date())}.`
  : `A successful check already exists for Beijing date ${beijingDateKey(new Date())}; skipping this retry.`;

console.log(message);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `should_run=${shouldRun}\n`, "utf8");
}
