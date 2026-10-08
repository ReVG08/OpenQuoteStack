type OperatorLog = {
  level: "info" | "warn" | "error";
  operation: string;
  requestId?: string;
  organizationId?: string;
  errorCategory?: string;
};
/** Only allow operational fields; exception messages and request payloads are excluded. */
export function operatorLog(record: OperatorLog) {
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), ...record }),
  );
}
