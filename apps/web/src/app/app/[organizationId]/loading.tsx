export default function Loading() {
  return (
    <div
      className="loading-state"
      aria-busy="true"
      aria-label="Loading / Carregando"
    >
      <div className="skeleton" style={{ width: "35%" }} />
      <div className="skeleton" style={{ width: "60%" }} />
      <div className="skeleton large" />
    </div>
  );
}
