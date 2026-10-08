import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
const encryptionKey = () => {
  const value = process.env.OQS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "OQS_ENCRYPTION_KEY must contain 32 random bytes in hexadecimal",
    );
  return Buffer.from(value, "hex");
};
export const secretHash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export function encryptSecret(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptSecret(value: string) {
  const [iv, tag, body] = value
    .split(".")
    .map((s) => Buffer.from(s, "base64url"));
  if (!iv || !tag || !body) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
