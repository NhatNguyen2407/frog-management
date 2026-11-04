(() => {
  "use strict";

  const labels = {
    vi: {
      title: "Đăng ký & Check-in",
      description: "Danh sách vé của workshop đang chọn.",
      search: "Tìm tên khách, mã vé hoặc mã đơn...",
      registered: "Vé hợp lệ",
      arrived: "Đã check-in",
      pending: "Chưa đến",
      unpaid: "Chờ thanh toán",
      ticket: "Mã vé",
      customer: "Khách hàng",
      order: "Mã đơn",
      status: "Check-in",
      action: "Thao tác",
      checkedIn: "Đã đến",
      notArrived: "Chưa đến",
      cancelled: "Đã hủy",
      refunded: "Đã hoàn tiền",
      paymentDue: "Chưa thanh toán",
      checkIn: "Check-in",
      undo: "Hoàn tác",
      empty: "Không có khách phù hợp.",
      missing: "Không tìm thấy vé.",
      invalid: "Vé đã bị hủy hoặc đơn không hợp lệ.",
      requirePaid: "Cần xác nhận thanh toán trước khi check-in.",
      already: "Khách đã check-in.",
      notChecked: "Khách chưa được check-in.",
      time: "Giờ đến",
    },
    en: {
      title: "Registrations & Check-in",
      description: "Tickets for the selected workshop.",
      search: "Search customer, ticket ID or order ID...",
      registered: "Valid tickets",
      arrived: "Checked in",
      pending: "Not arrived",
      unpaid: "Awaiting payment",
      ticket: "Ticket",
      customer: "Customer",
      order: "Order",
      status: "Check-in",
      action: "Action",
      checkedIn: "Checked in",
      notArrived: "Not arrived",
      cancelled: "Cancelled",
      refunded: "Refunded",
      paymentDue: "Unpaid",
      checkIn: "Check in",
      undo: "Undo",
      empty: "No matching registrations.",
      missing: "Ticket not found.",
      invalid: "Ticket cancelled or order invalid.",
      requirePaid: "Confirm payment before checking in.",
      already: "Customer already checked in.",
      notChecked: "Ticket is not checked in.",
      time: "Arrival",
    },
  };
  const translate = (locale) => labels[locale === "en" ? "en" : "vi"];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  function registrations(state, eventId) {
    const orders = new Map((state.orders || []).map((order) => [order.id, order]));
    return (state.tickets || [])
      .filter((ticket) => ticket.eventId === eventId)
      .map((ticket) => ({ ticket, order: orders.get(ticket.orderId) || null }))
      .sort((a, b) => (b.ticket.createdAt || "").localeCompare(a.ticket.createdAt || ""));
  }

  const isValid = ({ ticket, order }) =>
    ticket.status !== "cancelled" && !!order && !["cancelled", "refunded"].includes(order.status);
  const isPaid = ({ order }) => order?.status === "paid";

  function summary(state, eventId) {
    const active = registrations(state, eventId).filter(isValid);
    const paid = active.filter(isPaid);
    const arrived = paid.filter(({ ticket }) => !!ticket.checkedInAt).length;
    return {
      registered: active.length,
      arrived,
      pending: paid.length - arrived,
      unpaid: active.length - paid.length,
    };
  }

  function update(state, eventId, ticketId, action, timestamp, locale = "vi") {
    const l = translate(locale);
    const registration = registrations(state, eventId).find((item) => item.ticket.id === ticketId);
    if (!registration) return { error: l.missing };
    if (!isValid(registration)) return { error: l.invalid };
    if (!isPaid(registration)) return { error: l.requirePaid };

    const ticket = registration.ticket;
    if (action === "check-in") {
      if (ticket.checkedInAt) return { error: l.already };
      const at = timestamp || new Date().toISOString();
      if (Number.isNaN(Date.parse(at))) return { error: l.invalid };
      ticket.checkedInAt = at;
      return { ticket };
    }
    if (action === "undo") {
      if (!ticket.checkedInAt) return { error: l.notChecked };
      delete ticket.checkedInAt;
      return { ticket };
    }
    return { error: l.invalid };
  }

  function view(state, eventId, query = "", locale = "vi") {
    const l = translate(locale);
    const counts = summary(state, eventId);
    const needle = query.trim().toLocaleLowerCase();
    const rows = registrations(state, eventId).filter(({ ticket, order }) =>
      [ticket.id, ticket.customer, order?.customer, ticket.orderId].some((value) =>
        String(value || "")
          .toLocaleLowerCase()
          .includes(needle),
      ),
    );
    const stat = (value, label) =>
      '<div class="registration-stat"><strong>' +
      value +
      "</strong><small>" +
      label +
      "</small></div>";
    const cells = rows
      .map((entry) => {
        const { ticket, order } = entry;
        const valid = isValid(entry);
        const paid = isPaid(entry);
        const checked = valid && paid && !!ticket.checkedInAt;
        const status = !valid
          ? order?.status === "refunded"
            ? l.refunded
            : l.cancelled
          : !paid
            ? l.paymentDue
            : checked
              ? l.checkedIn
              : l.notArrived;
        const action =
          valid && paid
            ? '<button type="button" class="btn ' +
              (checked ? "secondary" : "soft") +
              ' small" data-act="registration-' +
              (checked ? "undo" : "check-in") +
              ":" +
              escapeHtml(ticket.id) +
              '">' +
              (checked ? l.undo : l.checkIn) +
              "</button>"
            : "";
        const checkedDate = checked
          ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(ticket.checkedInAt))
          : "";
        return (
          "<tr><td><strong>" +
          escapeHtml(ticket.id) +
          "</strong></td>" +
          "<td>" +
          escapeHtml(ticket.customer || order?.customer || "-") +
          "</td>" +
          "<td>" +
          escapeHtml(ticket.orderId) +
          "</td>" +
          '<td><span class="registration-status ' +
          (checked ? "is-arrived" : "") +
          '">' +
          status +
          "</span>" +
          (checkedDate ? "<small>" + l.time + ": " + escapeHtml(checkedDate) + "</small>" : "") +
          "</td><td>" +
          action +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<section class="panel registrations-panel">' +
      '<div class="registration-head"><div><h3>' +
      l.title +
      "</h3><p>" +
      l.description +
      "</p></div>" +
      '<div class="registration-stats">' +
      stat(counts.registered, l.registered) +
      stat(counts.arrived, l.arrived) +
      stat(counts.pending, l.pending) +
      stat(counts.unpaid, l.unpaid) +
      "</div></div>" +
      '<input id="registration-search" class="field registration-search" type="search" ' +
      'aria-label="' +
      l.search +
      '" placeholder="' +
      l.search +
      '" value="' +
      escapeHtml(query) +
      '" />' +
      '<div class="table-scroll"><table class="data-table"><thead><tr>' +
      [l.ticket, l.customer, l.order, l.status, l.action]
        .map((s) => "<th>" + s + "</th>")
        .join("") +
      "</tr></thead><tbody>" +
      (cells || '<tr><td colspan="5">' + l.empty + "</td></tr>") +
      "</tbody></table></div></section>"
    );
  }

  globalThis.FrogRegistrations = { registrations, summary, update, view };
})();
