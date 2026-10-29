(() => {
  "use strict";

  const messages = {
    vi: {
      missing: "Không tìm thấy đơn hàng.",
      invalid: "Không thể thực hiện thao tác với trạng thái hiện tại.",
      method: "Chọn phương thức thanh toán hợp lệ.",
      stock: "Không thể hoàn kho vì dữ liệu sản phẩm không hợp lệ.",
      busy: "Ticket đã bắt đầu hoặc hoàn thành. Không thể hủy đơn chưa thanh toán.",
      paid: "Xác nhận thanh toán",
      cancel: "Hủy đơn hàng",
      refund: "Hoàn tiền",
      paidHelp: "Đơn sẽ được tính vào doanh thu sau khi xác nhận.",
      cancelHelp: "Chỉ hủy đơn chưa thanh toán. Hàng đã giữ được hoàn về kho và ticket bị hủy.",
      refundHelp:
        "Hoàn tiền giả lập. Doanh thu được điều chỉnh, không nhập lại kho. Ticket chưa hoàn thành bị hủy.",
      payButton: "Đánh dấu đã thanh toán",
      cancelButton: "Hủy đơn",
      refundButton: "Hoàn tiền",
    },
    en: {
      missing: "Order not found.",
      invalid: "This action is not available for the current status.",
      method: "Choose a valid payment method.",
      stock: "Cannot restore stock because product data is invalid.",
      busy: "The ticket is in progress or completed. This unpaid order cannot be cancelled.",
      paid: "Confirm payment",
      cancel: "Cancel order",
      refund: "Refund",
      paidHelp: "The order will count toward revenue after confirmation.",
      cancelHelp:
        "Only unpaid orders can be cancelled. Reserved stock is restored and the ticket is cancelled.",
      refundHelp:
        "Simulated refund: revenue is reversed, stock is not restored, and unfinished tickets are cancelled.",
      payButton: "Mark paid",
      cancelButton: "Cancel",
      refundButton: "Refund",
    },
  };

  const labels = (locale) => messages[locale === "en" ? "en" : "vi"];
  const can = (order, action) =>
    !!order &&
    (action === "paid" || action === "cancel"
      ? order.status === "unpaid"
      : action === "refund"
        ? order.status === "paid"
        : false);

  function apply(state, id, action, options = {}) {
    const l = labels(options.locale);
    const order = state.orders.find((o) => o.id === id);
    if (!order) return { error: l.missing };
    if (!can(order, action)) return { error: l.invalid };
    const ticket = state.tickets.find((t) => t.orderId === id);
    const now = options.at || new Date().toISOString();

    if (action === "paid") {
      if (!["cash", "bank"].includes(options.method)) return { error: l.method };
      order.status = "paid";
      order.method = options.method;
      order.paidAt = now;
    } else if (action === "cancel") {
      if (ticket && ["in_progress", "completed"].includes(ticket.status)) return { error: l.busy };
      const quantities = new Map();
      for (const item of order.items) {
        if (!Number.isSafeInteger(item.qty) || item.qty < 1) return { error: l.stock };
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty);
      }
      const changes = [];
      for (const [productId, qty] of quantities) {
        const product = state.products.find((p) => p.id === productId);
        if (
          !product ||
          !Number.isSafeInteger(product.stock) ||
          !Number.isSafeInteger(product.stock + qty)
        )
          return { error: l.stock };
        changes.push([product, qty]);
      }
      for (const [product, qty] of changes) product.stock += qty;
      order.status = "cancelled";
      order.cancelledAt = now;
      if (ticket) ticket.status = "cancelled";
    } else if (action === "refund") {
      order.status = "refunded";
      order.refundedAt = now;
      // Refunds do not restore stock automatically.
      if (ticket && ticket.status !== "completed") ticket.status = "cancelled";
    }
    order.updatedAt = now;
    return { order };
  }

  function financialTotals(orders, expenses = 0) {
    const value = (order, key) => order.items.reduce((n, i) => n + i.qty * i[key], 0);
    const paid = orders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((n, o) => n + value(o, "price"), 0);
    // Refunded orders retain the product cost because stock is not returned.
    const cogs = orders
      .filter((o) => ["paid", "refunded"].includes(o.status))
      .reduce((n, o) => n + value(o, "cost"), 0);
    return { revenue, cogs, expenses, profit: revenue - cogs - expenses, paid: paid.length };
  }
  globalThis.FrogOrders = { messages, labels, can, apply, financialTotals };
})();
