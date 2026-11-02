(() => {
  "use strict";

  const transitions = {
    registered: "ticket_printed",
    ticket_printed: "waiting",
    waiting: "in_progress",
    in_progress: "completed"
  };
  const messages = {
    vi: {
      missing: "Không tìm thấy ticket trong workshop đang chọn.",
      order: "Không tìm thấy đơn hàng của ticket.",
      cancelled: "Ticket đã hủy hoặc đơn đã hủy/hoàn tiền.",
      unpaid: "Cần xác nhận thanh toán trước khi bắt đầu thực hiện.",
      finished: "Ticket đã hoàn thành hoặc không thể chuyển trạng thái.",
      next: "Bước tiếp"
    },
    en: {
      missing: "Ticket not found in the selected workshop.",
      order: "Ticket order not found.",
      cancelled: "Ticket or related order has been cancelled/refunded.",
      unpaid: "Payment must be confirmed before preparation starts.",
      finished: "Ticket is complete or cannot advance.",
      next: "Next step"
    }
  };

  function check(state, eventId, ticketId, locale = "vi") {
    const l = messages[locale === "en" ? "en" : "vi"];
    const ticket = state.tickets.find(t => t.id === ticketId && t.eventId === eventId);
    if (!ticket) return { error: l.missing };
    const order = state.orders.find(o => o.id === ticket.orderId && o.eventId === eventId);
    if (!order) return { error: l.order };
    if (ticket.status === "cancelled" || ["cancelled", "refunded"].includes(order.status))
      return { error: l.cancelled };
    const next = transitions[ticket.status];
    if (!next) return { error: l.finished };
    if (next === "in_progress" && order.status !== "paid") return { error: l.unpaid };
    return { ticket, next };
  }

  function advance(state, eventId, ticketId, at, locale = "vi") {
    const result = check(state, eventId, ticketId, locale);
    if (result.error) return result;
    const { ticket, next } = result;
    const timestamp = at || new Date().toISOString();
    if (Number.isNaN(Date.parse(timestamp))) return { error: messages.vi.finished };
    const previous = ticket.status;
    ticket.status = next;
    ticket.updatedAt = timestamp;
    ticket.statusHistory ||= [];
    ticket.statusHistory.push({ from: previous, to: next, at: timestamp });
    return { ticket, previous, next };
  }

  globalThis.FrogQueue = { messages, transitions, check, advance };
})();
