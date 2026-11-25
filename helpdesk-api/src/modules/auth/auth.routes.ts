import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware";
import * as auth from "./auth.service";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  res.status(201).json(await auth.register(name, email, password));
});

router.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await auth.login(email, password));
});

router.get("/me", authenticate, async (req, res) => {
  res.json(await auth.me(req.user!.id));
});

export default router;