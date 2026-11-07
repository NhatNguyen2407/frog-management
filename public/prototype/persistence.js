(() => {
  "use strict";
  const KEY = "frog-management-prototype-v1";

  const valid = (state) =>
    state &&
    Array.isArray(state.products) &&
    Array.isArray(state.events) &&
    Array.isArray(state.orders) &&
    Array.isArray(state.tickets) &&
    state.events.some((event) => event?.id === state.selectedEvent) &&
    state.orders.every((order) => order && Array.isArray(order.items));

  function read(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return valid(state) ? state : null;
    } catch {
      return null;
    }
  }

  function load(storage, initial) {
    let raw;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return { state: initial(), source: "unavailable" };
    }
    if (raw == null) return { state: initial(), source: "new" };
    try {
      const state = JSON.parse(raw);
      if (valid(state)) return { state, source: "stored" };
    } catch {
      // Leave the original stored data untouched.
    }
    return { state: initial(), source: "invalid" };
  }

  function save(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  const LAST_SALE = "frog-management-prototype-last-sale";
  function rememberSale(storage, orderId) {
    try {
      storage.setItem(LAST_SALE, orderId);
      return true;
    } catch {
      return false;
    }
  }
  function restoreSale(storage, state) {
    try {
      const id = storage.getItem(LAST_SALE);
      return (
        state.orders.find((order) => order.id === id && order.eventId === state.selectedEvent) ||
        null
      );
    } catch {
      return null;
    }
  }
  function clearSale(storage) {
    try {
      storage.removeItem(LAST_SALE);
    } catch {
      // Session storage may be disabled.
    }
  }

  globalThis.FrogPersistence = {
    KEY,
    LAST_SALE,
    read,
    load,
    save,
    rememberSale,
    restoreSale,
    clearSale,
  };
})();
