import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { AppError } from "./errors";

export type Role = "USER" | "ADMIN";
export interface AuthUser { id: string; role: Role }

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "Missing token");
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), config.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
  req.user = { id: payload.id, role: payload.role };
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "You do not have permission to do this");
    }
    next();
};