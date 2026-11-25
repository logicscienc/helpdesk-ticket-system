import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config, pool } from "../../config";
import { AppError } from "../../errors";

interface DbUser { id: string; name: string; email: string; password_hash: string; role: "USER" | "ADMIN" }

const sign = (u: DbUser) =>
  jwt.sign({ id: u.id, role: u.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const publicUser = ({ id, name, email, role }: DbUser) => ({ id, name, email, role });

export async function register(name: string, email: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  try {
    // role is never taken from the client: new accounts are always USER
    const { rows } = await pool.query<DbUser>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [name, email, hash]
    );
    return { token: sign(rows[0]), user: publicUser(rows[0]) };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AppError(409, "Email already registered");
    throw e;
  }
}

export async function login(email: string, password: string) {
  const { rows } = await pool.query<DbUser>(`SELECT * FROM users WHERE email = $1`, [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password");
  }
  return { token: sign(user), user: publicUser(user) };
}

export async function me(id: string) {
  const { rows } = await pool.query<DbUser>(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw new AppError(404, "User not found");
  return publicUser(rows[0]);
}