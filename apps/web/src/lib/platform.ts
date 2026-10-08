import { createPlatform } from "@openquotestack/database/platform";
import { getDatabase } from "@openquotestack/database";
export const platform = () => createPlatform(getDatabase());
