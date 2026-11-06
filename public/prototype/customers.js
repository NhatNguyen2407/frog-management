(() => {
  "use strict";

  const labels = {
    vi: {
      title: "Lịch sử khách hàng",
      description: "Tra cứu đơn hàng và ticket trên tất cả workshop.",
      search: "Tìm tên khách, mã đơn hoặc mã ticket...",
      orderCount: "Đơn phù hợp",
      workshopCount: "Workshop đã check-in",
      checkInCount: "Lượt check-in",
      notice: "Kết quả là các đơn hàng riêng lẻ. Trùng tên không có nghĩa là cùng một khách; chưa có Customer ID để xác thực.",
      empty: "Không tìm thấy đơn hàng phù hợp.",
      order: "Mã đơn / Ngày",
      customer: "Khách hàng",
      workshop: "Workshop",
      status: "Thanh toán",
      ticket: "Vé / Check-in",
      items: "Sản phẩm",
      actions: "Chi tiết",
      view: "Xem",
      checked: "Đã check-in",
      pending: "Chưa check-in",
      noTicket: "Không có vé",
      missingEvent: "Workshop không xác định",
      fallback: "Khách lẻ",
      paid: "Đã thanh toán",
      unpaid: "Chưa thanh toán",
      refunded: "Đã hoàn tiền",
      cancelled: "Đã hủy",
    },
    en: {
      title: "Customer history",
      description: "Search orders and tickets across all workshops.",
      search: "Search customer, order ID or ticket ID...",
      orderCount: "Matching orders",
      workshopCount: "Workshops checked in",
      checkInCount: "Check-ins",
      notice: "Each result is a separate order. Matching names do not prove customer identity; no unique Customer ID exists yet.",
      empty: "No matching orders found.",
      order: "Order / Date",
      customer: "Customer",
      workshop: "Workshop",
      status: "Payment",
      ticket: "Ticket / Check-in",
      items: "Items",
      actions: "Details",
      view: "View",
      checked: "Checked in",
      pending: "Not checked in",
      noTicket: "No ticket",
      missingEvent: "Unknown workshop",
      fallback: "Walk-in customer",
      paid: "Paid",
      unpaid: "Unpaid",
      refunded: "Refunded",
      cancelled: "Cancelled",
    },
  };
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const normalize = (value) =>
    String(value ?? "").toLocaleLowerCase().replace(/đ/g, "d")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  function find(state, query = "") {
    const events = new Map((state.events || []).map((e) => [e.id, e]));
    const tickets = new Map();
    for (const ticket of state.tickets || [])
      if (ticket.orderId && !tickets.has(ticket.orderId))
        tickets.set(ticket.orderId, ticket);
    const term = normalize(query);
    return (state.orders || [])
      .map((order) => {
        const ticket = tickets.get(order.id);
        return {
          order,
          event: events.get(order.eventId) || null,
          ticket: ticket?.eventId === order.eventId ? ticket : null,
        };
      })
      .filter(({ order, ticket }) =>
        !term || [order.customer, order.id, order.ticketId, ticket?.id, ticket?.customer]
          .some((value) => normalize(value).includes(term)),
      )
      .sort((a, b) => String(b.order.createdAt || "").localeCompare(String(a.order.createdAt || "")));
  }

  function summary(records) {
    const checked = records.filter(({ ticket }) => !!ticket?.checkedInAt);
    return {
      orders: records.length,
      workshops: new Set(checked.map(({ order }) => order.eventId)).size,
      checkIns: checked.length,
    };
  }

  function view(state, query = "", locale = "vi") {
    const l = labels[locale === "en" ? "en" : "vi"];
    const matches = find(state, query);
    const stats = summary(matches);
    const formatDate = (input) => {
      const date = new Date(input);
      return Number.isNaN(date.getTime()) ? "-" :
        new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
        }).format(date);
    };
    const stat = (n, label) => '<div class="customer-stat"><strong>' + n + '</strong><span>' + label + '</span></div>';
    const cell = (label, value) =>
      '<td data-label="' + escapeHtml(label) + '">' + value + "</td>";
    const rows = matches.map(({ order, event, ticket }) => {
      const ticketText = ticket
        ? "<strong>" + escapeHtml(ticket.id) + "</strong><small>" +
          (ticket.checkedInAt ? l.checked + " · " + formatDate(ticket.checkedInAt) : l.pending) +
          "</small>"
        : '<span class="customer-muted">' + l.noTicket + "</span>";
      const products = (order.items || [])
        .map((item) => escapeHtml(item.name || item.productId || "") + " ×" + Number(item.qty || 0))
        .join(", ");
      return "<tr>" +
        cell(l.order, "<strong>" + escapeHtml(order.id) + "</strong><small>" +
          formatDate(order.createdAt) + "</small>") +
        cell(l.customer, escapeHtml(order.customer || l.fallback)) +
        cell(l.workshop, escapeHtml(event?.name || l.missingEvent)) +
        cell(l.status, escapeHtml(l[order.status] || order.status || "-")) +
        cell(l.ticket, ticketText) +
        cell(l.items, products || "-") +
        cell(l.actions, '<button type="button" class="btn secondary small" data-act="details:' +
          escapeHtml(order.id) + '">' + l.view + "</button>") + "</tr>";
    }).join("");
    const headings = [l.order, l.customer, l.workshop, l.status, l.ticket, l.items, l.actions]
      .map(label => "<th>" + label + "</th>").join("");
    return '<section class="panel customer-history"><div class="panel-body">' +
      '<label class="form-field"><span>' + l.search +
      '</span><input type="search" id="customer-history-search" class="field" placeholder="' +
      l.search + '" value="' + escapeHtml(query) + '" autocomplete="off" /></label>' +
      '<div class="customer-stats">' + stat(stats.orders, l.orderCount) +
      stat(stats.workshops, l.workshopCount) + stat(stats.checkIns, l.checkInCount) +
      '</div><p class="customer-notice">' + l.notice + '</p></div>' +
      '<div class="table-scroll"><table class="data-table customer-table"><thead><tr>' +
      headings + '</tr></thead><tbody>' + (rows || '<tr class="customer-empty"><td colspan="7">' +
      l.empty + '</td></tr>') + '</tbody></table></div></section>';
  }

  globalThis.FrogCustomers = { labels, find, summary, view };
})();
