import bcrypt from "bcryptjs";
import { pool } from "../config";

async function run() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Admin', $1, $2, 'ADMIN')
     ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password_hash = $2`,
    [ADMIN_EMAIL.toLowerCase(), hash]
  );
  console.log("Admin ready:", ADMIN_EMAIL);
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });