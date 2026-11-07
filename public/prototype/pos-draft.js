(() => {
  "use strict";
  const PREFIX = "frog-management-prototype-pos-draft-v1:";
  const empty = () => ({
    cart: [],
    customer: "",
    method: "cash",
    payment: "paid",
    createTicket: true,
    skipped: 0,
  });
  const key = (eventId) => PREFIX + encodeURIComponent(eventId);

  function normalize(data, products = []) {
    const draft = empty();
    if (!data || typeof data !== "object") return draft;
    const known = new Set(products.map((product) => product.id));
    const lines = Array.isArray(data.cart) ? data.cart : [];
    for (const line of lines.slice(0, 100)) {
      if (
        !line ||
        typeof line.id !== "string" ||
        !known.has(line.id) ||
        !Number.isSafeInteger(line.qty) ||
        line.qty < 1 ||
        line.qty > 10000
      ) {
        draft.skipped++;
        continue;
      }
      draft.cart.push({
        id: line.id,
        key: "L" + (draft.cart.length + 1),
        qty: line.qty,
        note: typeof line.note === "string" ? line.note.slice(0, 160) : "",
      });
    }
    draft.customer = typeof data.customer === "string" ? data.customer.slice(0, 80) : "";
    draft.method = ["cash", "bank"].includes(data.method) ? data.method : "cash";
    draft.payment = ["paid", "unpaid"].includes(data.payment) ? data.payment : "paid";
    draft.createTicket = data.createTicket !== false;
    return draft;
  }

  function load(storage, eventId, products) {
    try {
      const raw = storage?.getItem(key(eventId));
      return raw ? normalize(JSON.parse(raw), products) : empty();
    } catch {
      return empty();
    }
  }

  function save(storage, eventId, data, products) {
    try {
      const draft = normalize(data, products);
      const hasData =
        draft.cart.length ||
        draft.customer.trim() ||
        draft.method !== "cash" ||
        draft.payment !== "paid" ||
        !draft.createTicket;
      if (!hasData) storage.removeItem(key(eventId));
      else
        storage.setItem(
          key(eventId),
          JSON.stringify({
            cart: draft.cart.map(({ id, qty, note }) => ({ id, qty, note })),
            customer: draft.customer,
            method: draft.method,
            payment: draft.payment,
            createTicket: draft.createTicket,
          }),
        );
      return true;
    } catch {
      return false;
    }
  }

  function clear(storage, eventId) {
    try {
      storage?.removeItem(key(eventId));
      return true;
    } catch {
      return false;
    }
  }
  function clearAll(storage) {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const item = storage.key(i);
        if (item?.startsWith(PREFIX)) storage.removeItem(item);
      }
      return true;
    } catch {
      return false;
    }
  }

  globalThis.FrogPosDraft = { PREFIX, empty, normalize, load, save, clear, clearAll };
})();
