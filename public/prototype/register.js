(() => {
  "use strict";
  const labels = {
    vi: {
      soldOut: "Hết hàng",
      inStock: "Còn",
      options: "Tùy chỉnh cho sản phẩm",
      placeholder: "Màu sắc, size, topping hoặc yêu cầu riêng...",
      noStock: "Không đủ hàng trong kho.",
      unavailable: "Sản phẩm không còn được bán.",
      empty: "Chưa có sản phẩm trong giỏ.",
      ticketFood: "Đơn F&B không cần workshop ticket.",
      capacity: "Workshop đã đủ số vé.",
      noEvent: "Chưa chọn workshop hợp lệ.",
    },
    en: {
      soldOut: "Sold out",
      inStock: "Left",
      options: "Item customization",
      placeholder: "Color, size, topping or special request...",
      noStock: "Not enough stock.",
      unavailable: "Product is unavailable.",
      empty: "Add products to the cart.",
      ticketFood: "Food-only orders cannot create workshop tickets.",
      capacity: "Workshop ticket capacity reached.",
      noEvent: "Invalid workshop selection.",
    },
  };
  const t = (locale) => labels[locale === "en" ? "en" : "vi"];
  const quantity = (cart, id) => cart.reduce((n, line) => n + (line.id === id ? line.qty : 0), 0);
  const hasWorkshop = (cart, products) =>
    cart.some((line) => products.some((p) => p.id === line.id && p.category === "workshop"));
  const canAdd = (cart, p) =>
    Boolean(
      p && p.active !== false && Number.isSafeInteger(p.stock) && quantity(cart, p.id) < p.stock,
    );
  function validate(cart, products, event, tickets, wantsTicket, locale = "vi") {
    const l = t(locale);
    if (!cart.length) return l.empty;
    for (const id of new Set(cart.map((line) => line.id))) {
      const p = products.find((x) => x.id === id);
      if (!p || p.active === false) return l.unavailable;
      if (
        cart.some((line) => line.id === id && (!Number.isInteger(line.qty) || line.qty < 1)) ||
        !Number.isSafeInteger(p.stock) ||
        quantity(cart, id) > p.stock
      )
        return l.noStock;
    }
    if (wantsTicket) {
      if (!hasWorkshop(cart, products)) return l.ticketFood;
      if (!event || !Number.isInteger(event.capacity) || event.capacity < 1) return l.noEvent;
      if (
        tickets.filter((ticket) => ticket.eventId === event.id && ticket.status !== "cancelled")
          .length >= event.capacity
      )
        return l.capacity;
    }
    return null;
  }
  globalThis.FrogRegister = { labels, quantity, hasWorkshop, canAdd, validate };
})();
