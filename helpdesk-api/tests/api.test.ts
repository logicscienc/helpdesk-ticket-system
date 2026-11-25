import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/index";
import { pool } from "../src/config";

const stamp = Date.now();
const userA = { name: "Test A", email: `a${stamp}@test.com`, password: "password123" };
const userB = { name: "Test B", email: `b${stamp}@test.com`, password: "password123" };
let tokenA = "", tokenB = "", tokenAdmin = "", ticketId = "";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  tokenA = (await request(app).post("/api/auth/register").send(userA)).body.token;
  tokenB = (await request(app).post("/api/auth/register").send(userB)).body.token;
  const admin = await request(app).post("/api/auth/login").send({
    email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
  });
  tokenAdmin = admin.body.token;
});

afterAll(async () => {
  // cascades to tickets, comments and logs
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`%${stamp}@test.com`]);
  await pool.end();
});

describe("auth", () => {
  it("health check works", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
  });

  it("ignores a role sent at registration", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ name: "Sneaky", email: `s${stamp}@test.com`, password: "password123", role: "ADMIN" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
  });

  it("rejects duplicate email and bad credentials", async () => {
    expect((await request(app).post("/api/auth/register").send(userA)).status).toBe(409);
    const bad = await request(app).post("/api/auth/login").send({ email: userA.email, password: "wrongpass1" });
    expect(bad.status).toBe(401);
  });

  it("blocks requests without a valid token", async () => {
    expect((await request(app).get("/api/tickets")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(auth("abc"))).status).toBe(401);
  });
});

describe("tickets and access control", () => {
  it("validates ticket input", async () => {
    const res = await request(app).post("/api/tickets").set(auth(tokenA)).send({ title: "Hi", description: "short" });
    expect(res.status).toBe(400);
  });

  it("lets a user create and read their own ticket", async () => {
    const res = await request(app).post("/api/tickets").set(auth(tokenA))
      .send({ title: "Cannot login", description: "I get an error when logging in", category: "TECHNICAL", priority: "HIGH" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("OPEN");
    ticketId = res.body.id;
    expect((await request(app).get(`/api/tickets/${ticketId}`).set(auth(tokenA))).status).toBe(200);
  });

  it("hides one user's ticket from another user (404)", async () => {
    expect((await request(app).get(`/api/tickets/${ticketId}`).set(auth(tokenB))).status).toBe(404);
    const list = await request(app).get("/api/tickets").set(auth(tokenB));
    expect(list.body.data).toHaveLength(0);
  });

  it("forbids users from using admin routes", async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}/manage`).set(auth(tokenA)).send({ status: "RESOLVED" });
    expect(res.status).toBe(403);
  });

  it("lets admin see all tickets and change status", async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}/manage`).set(auth(tokenAdmin))
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESOLVED");
    expect(res.body.resolved_at).not.toBeNull();
  });

  it("blocks owner edits once the ticket is not OPEN", async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}`).set(auth(tokenA)).send({ title: "late edit" });
    expect(res.status).toBe(409);
  });
});

describe("comments and events", () => {
  it("allows owner and admin comments but not outsiders", async () => {
    expect((await request(app).post(`/api/tickets/${ticketId}/comments`).set(auth(tokenA)).send({ body: "Thanks" })).status).toBe(201);
    expect((await request(app).post(`/api/tickets/${ticketId}/comments`).set(auth(tokenAdmin)).send({ body: "Welcome" })).status).toBe(201);
    expect((await request(app).post(`/api/tickets/${ticketId}/comments`).set(auth(tokenB)).send({ body: "intruder" })).status).toBe(404);
  });

  it("records events in the activity log", async () => {
    await new Promise((r) => setTimeout(r, 1000)); // listeners run asynchronously
    const res = await request(app).get(`/api/tickets/${ticketId}/activity`).set(auth(tokenA));
    const types = res.body.map((e: { event_type: string }) => e.event_type);
    expect(types).toEqual(expect.arrayContaining([
      "ticket.created", "ticket.status_changed", "ticket.resolved", "comment.added",
    ]));
  });

  it("returns stats scoped to the user", async () => {
    const res = await request(app).get("/api/tickets/stats").set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byStatus.RESOLVED).toBe(1);
  });
});