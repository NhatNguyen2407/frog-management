(() => {
  "use strict";
  const money = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";
  const escapeText = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const dateText = (value) => {
    if (!value) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return m[3] + "/" + m[2] + "/" + m[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
  };

  function renderBill(state, orderId) {
    const order = state?.orders?.find((o) => o.id === orderId);
    if (!order || !order.items?.length) return null;
    const event = state.events?.find((e) => e.id === order.eventId);
    const eventName = order.eventName || event?.name;
    const eventDate = order.eventDate || event?.date;
    const items = order.items.map((i) => ({
      name: i.name || state.products?.find((p) => p.id === i.productId)?.name || i.productId,
      qty: i.qty,
      price: i.price,
      note: i.note || "",
    }));
    const total = items.reduce((n, i) => n + i.qty * i.price, 0);
    const ticket = order.ticketId;
    const row = (key, value) =>
      '<div class="bill-row"><span>' + key + "</span><b>" + escapeText(value) + "</b></div>";
    const method = order.method === "bank" ? "Chuyển khoản" : "Tiền mặt";
    const status =
      {
        paid: "ĐÃ THANH TOÁN",
        unpaid: "CHƯA THANH TOÁN",
        refunded: "ĐÃ HOÀN TIỀN",
        cancelled: "ĐÃ HỦY",
      }[order.status] || order.status;
    return (
      '<header class="bill-brand"><img src="./assets/frog-logo.png" alt="" />' +
      "<div><b>DIOXYZINE FROG</b><small>THE FROG ART SPACE</small></div></header>" +
      '<div class="bill-label">' +
      (ticket ? "VÉ WORKSHOP" : "PHIẾU MUA HÀNG") +
      "</div>" +
      "<h1>" +
      escapeText(ticket || order.id) +
      "</h1>" +
      (ticket ? '<p class="bill-id">Đơn ' + escapeText(order.id) + "</p>" : "") +
      '<div class="bill-rule"></div>' +
      (order.customer ? row("Khách", order.customer) : "") +
      (ticket && eventName
        ? row("Workshop", eventName) + (eventDate ? row("Ngày tham gia", dateText(eventDate)) : "")
        : "") +
      row("Ngày mua", dateText(order.createdAt)) +
      '<div class="bill-rule"></div><b class="bill-heading">SẢN PHẨM</b>' +
      items
        .map(
          (i) =>
            '<div class="bill-item"><div class="bill-item-line"><span><b>' +
            escapeText(i.qty) +
            "×</b> " +
            escapeText(i.name) +
            "</span><b>" +
            money(i.qty * i.price) +
            "</b></div>" +
            (i.note ? "<small>Ghi chú: " + escapeText(i.note) + "</small>" : "") +
            "</div>",
        )
        .join("") +
      '<div class="bill-rule"></div><div class="bill-total"><b>TỔNG CỘNG</b><strong>' +
      money(total) +
      "</strong></div>" +
      row("Thanh toán", method) +
      '<p class="bill-status">' +
      escapeText(status) +
      "</p>" +
      "<footer>Cảm ơn bạn đã sáng tạo cùng Frog!<small>Giữ phiếu để đối chiếu khi nhận sản phẩm.</small>" +
      "<small>BẢN DEMO - KHÔNG PHẢI HÓA ĐƠN THẬT</small></footer>"
    );
  }
  globalThis.FrogCustomerBill = { renderBill };
  if (typeof document === "undefined" || !document.querySelector("#bill")) return;

  let state;
  try {
    state = JSON.parse(localStorage.getItem("frog-management-prototype-v1"));
  } catch {
    state = null;
  }
  const id = new URLSearchParams(location.search).get("order");
  const sheet = document.querySelector("#bill");
  const button = document.querySelector("#print");
  const warning = document.querySelector("#warning");
  const markup = renderBill(state, id);
  if (!markup) {
    sheet.textContent = "Không tìm thấy đơn hàng demo.";
    return;
  }
  sheet.innerHTML = markup;
  document.title = id + " - Frog Customer Bill";
  const fit = () => {
    const overflow = sheet.scrollHeight > sheet.clientHeight + 2;
    warning.hidden = !overflow;
    warning.textContent = overflow
      ? "Đơn hàng dài hơn một tem 76 × 130 mm. Cần kiểm tra mẫu in trước khi tiếp tục."
      : "";
    button.disabled = overflow;
  };
  requestAnimationFrame(fit);
  document.fonts?.ready?.then(fit);
  button.addEventListener("click", () => {
    fit();
    if (!button.disabled) window.print();
  });
  document.querySelector("#close").addEventListener("click", () => window.close());
})();
