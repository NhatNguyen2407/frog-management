(() => {
  "use strict";

  const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  const formattedDate = value => {
    if (!value) return "";
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (plain) return plain[3] + "/" + plain[2] + "/" + plain[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  function renderStaffSlip(state, orderId) {
    const order = state?.orders?.find(item => item.id === orderId);
    if (!order || !Array.isArray(order.items) || order.items.length === 0) return null;

    const event = state.events?.find(item => item.id === order.eventId);
    const ticketId = order.ticketId;
    const products = state.products || [];
    const classified = order.items.map(item => ({
      name: item.name || products.find(p => p.id === item.productId)?.name || item.productId,
      qty: item.qty,
      note: item.note || "",
      category: item.category || products.find(p => p.id === item.productId)?.category || "food"
    }));
    const group = (category, title) => {
      const entries = classified.filter(item => item.category === category);
      if (!entries.length) return "";
      return '<div class="staff-group"><h2>' + title + '</h2>' +
        entries.map(item => '<div class="staff-item"><strong class="staff-qty">' +
          escapeText(item.qty) + '×</strong><div><b>' + escapeText(item.name) + '</b>' +
          (item.note ? '<p>Ghi chú: ' + escapeText(item.note) + '</p>' : '') +
          '</div></div>').join("") + '</div>';
    };

    const status = {
      paid: "ĐÃ THANH TOÁN",
      unpaid: "CHƯA THANH TOÁN",
      cancelled: "ĐÃ HỦY",
      refunded: "ĐÃ HOÀN TIỀN"
    }[order.status] || order.status;

    return '<div class="staff-header"><b>THE FROG ART SPACE</b>' +
      '<h1>PHIẾU THỰC HIỆN</h1><div class="staff-code">' +
      escapeText(ticketId || order.id) + '</div>' +
      (ticketId ? '<small>Đơn: ' + escapeText(order.id) + '</small>' : '') +
      '</div><div class="staff-rule"></div>' +
      '<div class="staff-meta"><span>Khách</span><b>' +
      escapeText(order.customer || "Khách lẻ") + '</b></div>' +
      (ticketId && event ? '<div class="staff-meta"><span>Workshop</span><b>' +
        escapeText(event.name) + '</b></div><div class="staff-meta"><span>Ngày</span><b>' +
        formattedDate(event.date) + '</b></div>' : '') +
      '<div class="staff-meta"><span>Đặt lúc</span><b>' +
      formattedDate(order.createdAt) + '</b></div>' +
      '<div class="staff-rule"></div>' +
      group("workshop", "WORKSHOP") +
      group("food", "F&B / SẢN PHẨM KÈM") +
      '<div class="staff-rule"></div>' +
      '<div class="staff-meta"><span>Thanh toán</span><b>' + escapeText(status) + '</b></div>' +
      '<div class="staff-check"><span>□ Đã chuẩn bị</span><span>□ Đã bàn giao</span></div>' +
      '<footer class="staff-footer">PHIẾU NỘI BỘ - BẢN DEMO</footer>';
  }

  globalThis.FrogStaffSlip = { renderStaffSlip };
})();
