"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="narrow">
      <h1>Something went wrong / Algo deu errado</h1>
      <p>Please try again. / Tente novamente.</p>
      <button className="button" onClick={reset}>
        Retry / Tentar novamente
      </button>
    </main>
  );
}
