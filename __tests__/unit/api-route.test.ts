import { describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";

import { handleApiError, jsonCreated, jsonOk } from "@/lib/api-route";
import { ServiceError } from "@/lib/service-error";

describe("handleApiError", () => {
  it("maps ZodError to 400 with field errors", async () => {
    const schema = z.object({ name: z.string().min(1) });
    let zodError: ZodError;
    try {
      schema.parse({ name: "" });
      throw new Error("expected zod failure");
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = handleApiError(zodError!, "fallback");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Validation failed");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("maps ServiceError to its statusCode", async () => {
    const res = handleApiError(new ServiceError("Not found", 404), "fallback");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ success: false, message: "Not found" });
  });

  it("maps auth-like messages to 401", async () => {
    const res = handleApiError(new Error("Invalid token"), "fallback");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Invalid token");
  });

  it("maps duck-typed statusCode errors", async () => {
    const res = handleApiError(
      Object.assign(new Error("Nope"), { statusCode: 403 }),
      "fallback"
    );
    expect(res.status).toBe(403);
  });

  it("falls back to 500 and logs unknown errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError(new Error("boom"), "Unable to process");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("Unable to process");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("jsonOk / jsonCreated", () => {
  it("wraps data in success payload", async () => {
    const res = jsonOk({ id: "1" }, { pagination: { page: 1 } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "1" });
    expect(body.pagination).toEqual({ page: 1 });
  });

  it("returns 201 for created", async () => {
    const res = jsonCreated({ id: "2" }, "Created");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Created");
  });
});
