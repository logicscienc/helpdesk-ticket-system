import fs from "node:fs";
import path from "node:path";
import { pool } from "../config";

async function run() {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Migration complete");
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });