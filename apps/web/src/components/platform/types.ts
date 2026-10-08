import type React from "react";
export type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
export type Endpoint = {
  id: string;
  url: string;
  subscriptions: string[];
  active: boolean;
};
export type Delivery = {
  id: string;
  endpointId: string;
  eventId: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  durationMs: number | null;
  errorCategory: string | null;
};
export type Domain = {
  id: string;
  hostname: string;
  status: string;
  verifyToken: string;
  errorCategory: string | null;
};
export type Audit = {
  id: string;
  action: string;
  actorId: string;
  resourceId: string;
  createdAt: string;
};
export type Integrations = {
  notifications: {
    notifyEmail?: string;
    customerConfirmation?: boolean;
    footer?: string;
  };
  embedOrigins: string[];
};
export type Status = {
  version: string;
  build: string;
  database: boolean;
  storage: boolean;
  storageDriver: string;
  smtp: boolean;
  worker: boolean;
  pending: number | null;
  failed: number | null;
};
export type PanelData =
  | Key[]
  | { endpoints: Endpoint[]; deliveries: Delivery[] }
  | Domain[]
  | Audit[]
  | Integrations
  | Status;
export type PanelContext = {
  pending: boolean;
  mutate: (operation: string, input: unknown) => void;
  t: (en: string, br: string) => string;
  date: (value: string | null) => string;
  feedbackView: React.ReactNode;
};
