(() => {
  "use strict";
  const pages = [
    "dashboard", "pos", "products", "orders", "customers",
    "events", "queue", "inventory", "reports", "settings",
  ];
  const allowed = (page, role) =>
    pages.includes(page) && (role === "owner" || !["products", "customers"].includes(page));
  const resolve = (hash, role) => {
    const page = String(hash || "").replace(/^#/, "");
    return allowed(page, role) ? page : "dashboard";
  };
  function visit(page, role, location, history) {
    const selected = resolve("#" + page, role);
    history.replaceState(null, "", location.pathname + location.search + "#" + selected);
    return selected;
  }
  globalThis.FrogNavigation = { allowed, resolve, visit };
})();
