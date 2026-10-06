import { getDatabase } from "@openquotestack/database";
import { createServices } from "@openquotestack/database/services";
import { EventBus } from "@openquotestack/core";
export const events = new EventBus();
export const services = () => createServices(getDatabase(), events);
