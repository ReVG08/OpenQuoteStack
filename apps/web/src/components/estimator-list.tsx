"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@openquotestack/ui";
import { copy, dateLabel } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { estimatorOperation } from "@/app/product-actions";
import type { EstimatorDocument } from "@openquotestack/schema";
export function exportDocument(doc: EstimatorDocument) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(doc, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.estimator.id}.oqs.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Entry = {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  publishedNumber?: number;
  completions: number;
  leads: number;
  document: EstimatorDocument;
};
export function EstimatorList({
  entries,
  orgId,
  slug,
  locale,
  canEdit,
  canPublish,
}: {
  entries: Entry[];
  orgId: string;
  slug: string;
  locale: Locale;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const t = copy(locale),
    router = useRouter(),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState(false),
    [deleting, setDeleting] = useState<Entry>(),
    dialog = useRef<HTMLDialogElement>(null);
  const run = (entry: Entry, operation: string, confirmation = "") =>
    startTransition(async () => {
      setError(false);
      const r = await estimatorOperation(
        orgId,
        entry.id,
        operation,
        confirmation,
      );
      if (!r.ok) {
        setError(true);
        return;
      }
      dialog.current?.close();
      if (r.id) router.push(`/app/${orgId}/estimators/${r.id}`);
      else router.refresh();
    });
  if (!entries.length)
    return (
      <section className="empty-state">
        <span className="empty-symbol" aria-hidden="true">
          ▤
        </span>
        <h2>{t("empty")}</h2>
        <p>{t("emptyHelp")}</p>
        {canEdit && (
          <Link className="button" href={`/app/${orgId}/templates`}>
            {t("choose")} →
          </Link>
        )}
      </section>
    );
  return (
    <>
      {error && <p role="alert">{t("failure")}</p>}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("status")}</th>
              <th>{t("revision")}</th>
              <th>
                {t("completions")}
                <small>{t("last30")}</small>
              </th>
              <th>{t("leads")}</th>
              <th>{t("date")}</th>
              <th>
                <span className="sr-only">{t("edit")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <Link
                    className="strong-link"
                    href={`/app/${orgId}/estimators/${entry.id}`}
                  >
                    {entry.name}
                  </Link>
                </td>
                <td>
                  <span className={`status status-${entry.status}`}>
                    {t(entry.status)}
                  </span>
                </td>
                <td>{entry.publishedNumber ?? "—"}</td>
                <td>{entry.completions}</td>
                <td>{entry.leads}</td>
                <td>{dateLabel(entry.updatedAt, locale)}</td>
                <td>
                  <details className="row-menu">
                    <summary aria-label={`${t("edit")} ${entry.name}`}>
                      •••
                    </summary>
                    <div className="menu-panel">
                      <Link href={`/app/${orgId}/estimators/${entry.id}`}>
                        {t("edit")} / {t("preview")}
                      </Link>
                      {entry.status === "published" && (
                        <Link href={`/q/${slug}/${entry.id}`} target="_blank">
                          {t("publicLink")} ↗
                        </Link>
                      )}
                      <Link
                        href={`/app/${orgId}/estimates?estimator=${entry.id}`}
                      >
                        {t("estimates")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => exportDocument(entry.document)}
                      >
                        {t("export")}
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(entry, "duplicate")}
                          >
                            {t("duplicate")}
                          </button>
                          <button
                            type="button"
                            disabled={pending || entry.status === "archived"}
                            onClick={() => run(entry, "archive")}
                          >
                            {t("archive")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className="danger"
                            onClick={() => {
                              setDeleting(entry);
                              dialog.current?.showModal();
                            }}
                          >
                            {t("delete")}
                          </button>
                        </>
                      )}
                      {canPublish && entry.status === "published" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(entry, "unpublish")}
                        >
                          {t("unpublish")}
                        </button>
                      )}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog ref={dialog}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (deleting)
              run(
                deleting,
                "delete",
                String(new FormData(event.currentTarget).get("confirmation")),
              );
          }}
        >
          <h2>
            {t("delete")} {deleting?.name}
          </h2>
          <p>{t("deleteHelp")}</p>
          <label>
            {t("name")}
            <input name="confirmation" required autoComplete="off" />
          </label>
          {error && <p role="alert">{t("deleteHelp")}</p>}
          <div className="actions">
            <Button
              type="button"
              className="secondary"
              onClick={() => dialog.current?.close()}
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending} className="danger">
              {t("delete")}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
