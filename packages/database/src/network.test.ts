import { EventEmitter } from "node:events";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: transport.lookup }));
vi.mock("node:https", () => ({ request: transport.request }));
import { postWebhook } from "./network";
beforeEach(() => {
  vi.useFakeTimers();
  transport.lookup.mockReset();
  transport.request.mockReset();
});
afterEach(() => vi.useRealTimers());
it("pins the validated DNS address while preserving the TLS hostname and returns redirects without following them", async () => {
  transport.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  const req = new EventEmitter() as EventEmitter & {
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  req.end = vi.fn();
  req.destroy = vi.fn();
  transport.request.mockReturnValue(req);
  const pending = postWebhook("https://hooks.example.com/receive", "{}", {});
  await vi.advanceTimersByTimeAsync(0);
  const [url, options, receive] = transport.request.mock.calls[0]!;
  expect(url.hostname).toBe("hooks.example.com");
  expect(options).toMatchObject({ method: "POST", agent: false, family: 4 });
  const resolved = vi.fn();
  options.lookup("hooks.example.com", {}, resolved);
  expect(resolved).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  const destroy = vi.fn();
  receive({
    statusCode: 302,
    headers: { location: "http://127.0.0.1/" },
    destroy,
  });
  expect((await pending).status).toBe(302);
  expect(transport.request).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalled();
  req.emit("close");
});
it("blocks DNS rebinding to a private address on a subsequent attempt", async () => {
  transport.lookup.mockResolvedValue([
    { address: "169.254.169.254", family: 4 },
  ]);
  await expect(
    postWebhook("https://hooks.example.com/", "{}", {}),
  ).rejects.toThrow("public addresses");
  expect(transport.request).not.toHaveBeenCalled();
});
it("bounds DNS resolution and the delivery connection", async () => {
  transport.lookup.mockReturnValue(new Promise(() => {}));
  const dns = expect(
    postWebhook("https://hooks.example.com/", "{}", {}),
  ).rejects.toThrow("dns_timeout");
  await vi.advanceTimersByTimeAsync(5000);
  await dns;
  transport.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  const req = new EventEmitter() as EventEmitter & {
    end: () => void;
    destroy: (error: Error) => void;
  };
  req.end = () => {};
  req.destroy = (error) => {
    req.emit("error", error);
    req.emit("close");
  };
  transport.request.mockReturnValue(req);
  const delivery = expect(
    postWebhook("https://hooks.example.com/", "{}", {}),
  ).rejects.toThrow("Delivery timeout");
  await vi.advanceTimersByTimeAsync(10000);
  await delivery;
});
