import { resolve } from "node:path";
// Upload storage is provisioned at runtime, independently of the server bundle.
export const assetDirectory = () =>
  resolve(
    /* turbopackIgnore: true */ process.env.OQS_ASSET_DIR ?? ".local/assets",
  );
export function assetFile(orgId: string, filename: string): string {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(orgId) ||
    !/^[-a-zA-Z0-9_]{1,100}\.(png|jpg|webp)$/.test(filename)
  )
    throw new Error("Invalid asset path");
  return resolve(/* turbopackIgnore: true */ assetDirectory(), orgId, filename);
}
