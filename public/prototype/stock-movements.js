(() => {
  "use strict";

  const labels = {
    vi: {
      in: "Nhập kho",
      out: "Xuất kho",
      adjust: "Điều chỉnh",
      sale: "Bán hàng",
      cancel: "Hoàn kho",
      title: "Lịch sử biến động kho",
      kind: "Loại",
      quantity: "Số lượng",
      target: "Tồn kho mới",
      reason: "Lý do",
      save: "Xác nhận",
      date: "Thời gian",
      product: "Sản phẩm",
      previous: "Trước",
      after: "Sau",
      empty: "Chưa có biến động kho được ghi nhận.",
      missing: "Không tìm thấy sản phẩm.",
      invalid: "Số lượng phải là số nguyên không âm.",
      positive: "Số lượng phải lớn hơn 0.",
      shortage: "Không đủ tồn kho.",
      overflow: "Số tồn vượt giới hạn an toàn.",
      unchanged: "Tồn kho không thay đổi.",
      required: "Nhập lý do (2-120 ký tự).",
      invalidKind: "Loại biến động không hợp lệ.",
    },
    en: {
      in: "Stock in",
      out: "Stock out",
      adjust: "Adjust",
      sale: "Sale",
      cancel: "Restock",
      title: "Stock movement history",
      kind: "Movement",
      quantity: "Quantity",
      target: "New stock",
      reason: "Reason",
      save: "Confirm",
      date: "Time",
      product: "Product",
      previous: "Before",
      after: "After",
      empty: "No stock movements recorded yet.",
      missing: "Product not found.",
      invalid: "Quantity must be a nonnegative integer.",
      positive: "Quantity must be greater than zero.",
      shortage: "Insufficient stock.",
      overflow: "Stock quantity exceeds safe limit.",
      unchanged: "No stock change.",
      required: "Enter a reason (2-120 characters).",
      invalidKind: "Invalid movement type.",
    },
  };
  const lang = (locale) => labels[locale === "en" ? "en" : "vi"];
  const escape = (value) =>
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

  function journal(state) {
    if (!Array.isArray(state.stockMovements)) state.stockMovements = [];
    if (!Number.isSafeInteger(state.nextStockMovement) || state.nextStockMovement < 1) {
      const max = state.stockMovements.reduce(
        (n, item) => Math.max(n, Number(item.sequence) || 0),
        0,
      );
      state.nextStockMovement = max + 1;
    }
    return state.stockMovements;
  }

  // Record a change already reflected in product.stock (used for sales/cancellations).
  function log(state, productId, delta, kind, reason, at, orderId = "") {
    const product = state.products.find((item) => item.id === productId);
    if (
      !product ||
      !Number.isSafeInteger(delta) ||
      delta === 0 ||
      !Number.isSafeInteger(product.stock) ||
      product.stock < 0 ||
      !Number.isSafeInteger(product.stock - delta) ||
      product.stock - delta < 0
    )
      return { error: lang().invalid };

    const items = journal(state);
    const sequence = state.nextStockMovement++;
    const movement = {
      sequence,
      id: "ST-" + String(sequence).padStart(5, "0"),
      productId,
      productName: product.name,
      kind,
      delta,
      before: product.stock - delta,
      after: product.stock,
      reason,
      orderId,
      at: at || new Date().toISOString(),
    };
    items.push(movement);
    return { movement };
  }

  // Manual stock updates are checked before touching quantity or history.
  function apply(state, productId, kind, rawQuantity, reason, at, locale = "vi") {
    const l = lang(locale);
    const product = state.products.find((item) => item.id === productId);
    if (!product) return { error: l.missing };
    if (!["in", "out", "adjust"].includes(kind)) return { error: l.invalidKind };
    const input = String(rawQuantity ?? "").trim();
    const qty = Number(input);
    if (!/^\d+$/.test(input) || !Number.isSafeInteger(qty)) return { error: l.invalid };
    if (kind !== "adjust" && qty === 0) return { error: l.positive };
    const note = String(reason ?? "").trim();
    if (note.length < 2 || note.length > 120) return { error: l.required };
    if (!Number.isSafeInteger(product.stock) || product.stock < 0) return { error: l.invalid };

    const next = kind === "in" ? product.stock + qty : kind === "out" ? product.stock - qty : qty;
    if (!Number.isSafeInteger(next)) return { error: l.overflow };
    if (next < 0) return { error: l.shortage };
    if (next === product.stock) return { error: l.unchanged };
    const delta = next - product.stock;
    product.stock = next;
    return log(state, productId, delta, kind, note, at);
  }

  function view(state, locale = "vi") {
    const l = lang(locale);
    const history = Array.isArray(state.stockMovements) ? state.stockMovements : [];
    const entries = history.slice().reverse().slice(0, 30);
    const rows = entries
      .map((item) => {
        const product = state.products.find((p) => p.id === item.productId);
        const date = new Date(item.at);
        const timestamp = Number.isNaN(date.getTime())
          ? ""
          : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(date);
        return (
          "<tr><td>" +
          escape(timestamp) +
          "</td><td><strong>" +
          escape(item.productName || product?.name || item.productId) +
          "</strong><small>" +
          escape(item.productId) +
          "</small></td><td>" +
          escape(l[item.kind] || item.kind) +
          "</td><td><strong>" +
          (item.delta > 0 ? "+" : "") +
          escape(item.delta) +
          "</strong></td><td>" +
          escape(item.before) +
          " → " +
          escape(item.after) +
          "</td><td>" +
          escape(item.reason) +
          (item.orderId ? "<small>" + escape(item.orderId) + "</small>" : "") +
          "</td></tr>"
        );
      })
      .join("");
    const heads = [l.date, l.product, l.kind, l.quantity, l.after, l.reason]
      .map((s) => "<th>" + s + "</th>")
      .join("");
    return (
      '<section class="panel stock-history"><div class="panel-head"><h3>' +
      l.title +
      '</h3></div><div class="table-scroll"><table class="data-table"><thead><tr>' +
      heads +
      "</tr></thead><tbody>" +
      (rows || '<tr><td colspan="6">' + l.empty + "</td></tr>") +
      "</tbody></table></div></section>"
    );
  }

  function editor(product, locale = "vi") {
    const l = lang(locale);
    return (
      "<h2>" +
      escape(product.name) +
      "</h2><p>" +
      l.after +
      ": <strong>" +
      product.stock +
      '</strong></p><form id="stock-movement-form">' +
      '<label class="form-field"><span>' +
      l.kind +
      "</span>" +
      '<select name="kind" class="field">' +
      ["in", "out", "adjust"]
        .map((kind) => '<option value="' + kind + '">' + l[kind] + "</option>")
        .join("") +
      "</select></label>" +
      '<label class="form-field"><span>' +
      l.quantity +
      " / " +
      l.target +
      "</span>" +
      '<input name="quantity" class="field" type="number" min="0" step="1" required /></label>' +
      '<label class="form-field"><span>' +
      l.reason +
      "</span>" +
      '<input name="reason" class="field" maxlength="120" required /></label>' +
      '<p class="stock-error" id="stock-error" role="alert" hidden></p>' +
      '<div class="modal-footer"><button class="btn" type="submit">' +
      l.save +
      "</button></div></form>"
    );
  }

  globalThis.FrogStock = { labels, journal, log, apply, view, editor };
})();
