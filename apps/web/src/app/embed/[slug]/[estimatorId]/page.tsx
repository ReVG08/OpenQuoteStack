import { notFound } from "next/navigation";
import PublicEstimator from "@/app/q/[slug]/[estimatorId]/page";
import { EmbedResize } from "@/components/embed-resize";
import { services } from "@/lib/services";
export const dynamic = "force-dynamic";
export default async function Embed({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; estimatorId: string }>;
  searchParams: Promise<{ parentOrigin?: string; channel?: string }>;
}) {
  const { slug, estimatorId } = await params,
    { parentOrigin, channel } = await searchParams;
  let org;
  try {
    org = (await services().publicEstimator(slug, estimatorId)).organization;
  } catch {
    notFound();
  }
  const allowed = [
    new URL(process.env.BETTER_AUTH_URL!).origin,
    ...org.embedOrigins,
  ];
  if (parentOrigin && !allowed.includes(parentOrigin)) notFound();
  if (channel && !/^[a-zA-Z0-9_-]{1,100}$/.test(channel)) notFound();
  return (
    <div className="embed-page">
      <PublicEstimator params={params} />
      {parentOrigin && channel && (
        <EmbedResize origin={parentOrigin} channel={channel} />
      )}
    </div>
  );
}
