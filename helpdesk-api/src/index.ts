import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { AppError, errorHandler } from "./errors";
import { registerListeners } from "./events";
import authRoutes from "./modules/auth/auth.routes";
import ticketRoutes from "./modules/tickets/tickets.routes";

export const app = express(); // exported so tests can import it without opening a port

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use(() => { throw new AppError(404, "Route not found"); });
app.use(errorHandler);

registerListeners();

if (require.main === module) {
  app.listen(config.PORT, () => console.log(`API running on :${config.PORT}`));
}