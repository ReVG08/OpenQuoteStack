import type { PrismaClient } from "./index";
import { keysServices } from "./platform-keys";
import { resourcesServices } from "./platform-resources";
import { webhooksServices } from "./platform-webhooks";
import { domainsServices } from "./platform-domains";
import { integrationsServices } from "./platform-integrations";
import { consumeRate } from "./platform-context";
export {
  PlatformError,
  requireScope,
  paginationInput,
  type ApiPrincipal,
} from "./platform-context";
export function createPlatform(db: PrismaClient) {
  return {
    consumeRate: (key: string, limit: number) => consumeRate(db, key, limit),
    ...keysServices(db),
    ...resourcesServices(db),
    ...webhooksServices(db),
    ...domainsServices(db),
    ...integrationsServices(db),
  };
}
