import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware";
import * as tickets from "./tickets.service";
import * as comments from "./comments.service";
import { CATEGORIES, PRIORITIES, STATUSES } from "./tickets.service";

const idSchema = z.string().uuid();

const base = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
});
const createSchema = base.extend({
  category: z.enum(CATEGORIES).default("GENERAL"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
});
const updateSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field" });

const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const adminSchema = z
  .object({ status: z.enum(STATUSES), priority: z.enum(PRIORITIES) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide status or priority" });

const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

const router = Router();
router.use(authenticate);

router.post("/", async (req, res) => {
  res.status(201).json(await tickets.create(req.user!, createSchema.parse(req.body)));
});

router.get("/", async (req, res) => {
  res.json(await tickets.list(req.user!, listSchema.parse(req.query)));
});

router.get("/stats", async (req, res) => {
  res.json(await tickets.stats(req.user!));
});

router.get("/:id", async (req, res) => {
  res.json(await tickets.getAccessible(idSchema.parse(req.params.id), req.user!));
});

router.patch("/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.json(await tickets.update(id, req.user!, updateSchema.parse(req.body)));
});

router.delete("/:id", async (req, res) => {
  await tickets.remove(idSchema.parse(req.params.id), req.user!);
  res.status(204).send();
});

// Admin only: change status / priority
router.patch("/:id/manage", requireRole("ADMIN"), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.json(await tickets.adminUpdate(id, req.user!, adminSchema.parse(req.body)));
});

// Comments
router.get("/:id/comments", async (req, res) => {
  res.json(await comments.list(idSchema.parse(req.params.id), req.user!));
});
router.post("/:id/comments", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.status(201).json(await comments.add(id, req.user!, commentSchema.parse(req.body).body));
});

// Activity log (events)
router.get("/:id/activity", async (req, res) => {
  res.json(await tickets.activity(idSchema.parse(req.params.id), req.user!));
});

export default router;