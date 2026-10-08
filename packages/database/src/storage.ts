import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
export type AssetStorage = {
  put(key: string, body: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};
export function assetKey(orgId: string, filename: string) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(orgId) ||
    !/^[-a-zA-Z0-9_]{1,100}\.(png|jpg|webp)$/.test(filename)
  )
    throw new Error("Invalid asset key");
  return `${orgId}/${filename}`;
}
const validate = (key: string) => {
  const parts = key.split("/");
  if (parts.length !== 2) throw new Error("Invalid asset key");
  return assetKey(parts[0]!, parts[1]!);
};
export function localStorage(directory: string): AssetStorage {
  const file = (key: string) =>
    resolve(/* turbopackIgnore: true */ directory, validate(key));
  return {
    async put(key, body) {
      if (body.byteLength > 2000000) throw new Error("Asset too large");
      const path = file(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body, { mode: 0o640, flag: "wx" });
    },
    async get(key) {
      const data = await readFile(/* turbopackIgnore: true */ file(key));
      if (data.byteLength > 2000000) throw new Error("Asset too large");
      return data;
    },
    async remove(key) {
      await unlink(file(key));
    },
  };
}
export function s3Storage(
  client: S3Client,
  bucket: string,
  prefix = "assets",
): AssetStorage {
  if (!bucket || !/^[a-zA-Z0-9/_-]{0,100}$/.test(prefix))
    throw new Error("Invalid storage configuration");
  const key = (value: string) =>
    `${prefix ? `${prefix}/` : ""}${validate(value)}`;
  return {
    async put(value, body) {
      if (body.byteLength > 2000000) throw new Error("Asset too large");
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key(value),
          Body: body,
          ContentType: value.endsWith(".png")
            ? "image/png"
            : value.endsWith(".jpg")
              ? "image/jpeg"
              : "image/webp",
        }),
      );
    },
    async get(value) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key(value) }),
      );
      if (!result.Body) throw new Error("Asset missing");
      const body = result.Body as AsyncIterable<Uint8Array> & {
        destroy?: () => void;
      };
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of body) {
        size += chunk.byteLength;
        if (size > 2000000) {
          body.destroy?.();
          throw new Error("Asset too large");
        }
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    },
    async remove(value) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key(value) }),
      );
    },
  };
}
let storage: AssetStorage | undefined;
export function getAssetStorage(): AssetStorage {
  if (storage) return storage;
  if (process.env.OQS_STORAGE_DRIVER === "s3") {
    storage = s3Storage(
      new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        maxAttempts: 3,
        ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              },
            }
          : {}),
      }),
      process.env.S3_BUCKET ?? "",
      process.env.S3_PREFIX ?? "assets",
    );
  } else if (
    !process.env.OQS_STORAGE_DRIVER ||
    process.env.OQS_STORAGE_DRIVER === "local"
  )
    storage = localStorage(
      resolve(
        /* turbopackIgnore: true */ process.env.OQS_ASSET_DIR ??
          ".local/assets",
      ),
    );
  else throw new Error("Unsupported storage driver");
  return storage;
}
