import { OpenQuoteStack, OpenQuoteStackError } from "@openquotestack/sdk";
const apiKey = process.env.OPENQUOTESTACK_API_KEY;
if (!apiKey)
  throw new Error("Set OPENQUOTESTACK_API_KEY with estimators:read scope");
const oqs = new OpenQuoteStack({
  apiKey,
  baseUrl: process.env.OPENQUOTESTACK_BASE_URL ?? "http://localhost:3000",
});
try {
  const page = await oqs.estimators.list({ limit: 10 });
  console.log(page.data.map(({ id, name, status }) => ({ id, name, status })));
} catch (error) {
  if (error instanceof OpenQuoteStackError) {
    console.error({
      code: error.code,
      status: error.status,
      requestId: error.requestId,
    });
    process.exitCode = 1;
  } else throw error;
}
