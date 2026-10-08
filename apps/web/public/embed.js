(() => {
  "use strict";
  const script = document.currentScript;
  if (!script) return;
  const origin = new URL(script.src).origin;
  const mount = () =>
    document.querySelectorAll("[data-oqs-estimator]").forEach((container) => {
      if (container.dataset.oqsMounted) return;
      const id = container.dataset.oqsEstimator,
        organization = container.dataset.oqsOrganization;
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(id || "") ||
        !/^[a-z0-9-]{2,60}$/.test(organization || "")
      )
        return;
      container.dataset.oqsMounted = "true";
      const channel = crypto.randomUUID(),
        frame = document.createElement("iframe"),
        status = document.createElement("p");
      const url = new URL(`/embed/${organization}/${id}`, origin);
      url.searchParams.set("parentOrigin", location.origin);
      url.searchParams.set("channel", channel);
      frame.src = url.href;
      frame.title = container.dataset.oqsTitle || "Quote calculator";
      frame.style.cssText =
        "width:100%;min-height:400px;height:700px;border:0;display:block;";
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      status.textContent =
        container.dataset.oqsLoading || "Loading quote calculator…";
      status.setAttribute("role", "status");
      container.append(status, frame);
      let loaded = false;
      const timer = setTimeout(() => {
        if (!loaded) {
          status.textContent =
            container.dataset.oqsError || "Unable to load the calculator. ";
          const link = document.createElement("a");
          link.href = new URL(`/q/${organization}/${id}`, origin).href;
          link.textContent = container.dataset.oqsOpen || "Open calculator";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          status.append(link);
        }
      }, 15000);
      window.addEventListener("message", (event) => {
        if (
          event.origin !== origin ||
          event.source !== frame.contentWindow ||
          !event.data ||
          event.data.type !== "oqs:resize/v1" ||
          event.data.channel !== channel
        )
          return;
        const height = event.data.height;
        if (!Number.isInteger(height) || height < 80 || height > 10000) return;
        frame.style.height = `${height}px`;
        loaded = true;
        clearTimeout(timer);
        status.hidden = true;
      });
    });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
