import "dotenv/config";
import { z } from "zod";
import { Pool } from "pg";

export const config = z
  .object({
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default("1d"),
  })
  .parse(process.env);

export const pool = new Pool({ connectionString: config.DATABASE_URL });