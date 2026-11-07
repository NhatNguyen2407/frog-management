(() => {
  "use strict";
  const labels = (locale = "vi") =>
    locale === "en"
      ? {
          from: "From",
          to: "To",
          clear: "Clear",
          export: "Export CSV",
          orders: "Orders",
          revenue: "Revenue",
          expenses: "Expenses",
          scope: "Filters apply to reports and CSV. Expense management below shows all dates.",
          snapshot: "Current order status snapshot, not an accounting ledger.",
          badDate: "Invalid date range.",
          badEvent: "Workshop not found.",
        }
      : {
          from: "Từ ngày",
          to: "Đến ngày",
          clear: "Xóa lọc",
          export: "Xuất CSV",
          orders: "Đơn hàng",
          revenue: "Doanh thu",
          expenses: "Chi phí",
          scope: "Bộ lọc áp dụng cho báo cáo và CSV. Quản lý chi phí bên dưới hiển thị mọi ngày.",
          snapshot: "Số liệu theo trạng thái đơn hiện tại, không phải sổ kế toán.",
          badDate: "Khoảng ngày không hợp lệ.",
          badEvent: "Không tìm thấy workshop.",
        };
  const validDay = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  function dayKey(value) {
    if (!value) return "";
    if (validDay(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return [get("year"), get("month"), get("day")].join("-");
  }
  const orderDay = (order) =>
    dayKey(
      order.status === "paid"
        ? order.paidAt || order.createdAt
        : order.status === "refunded"
          ? order.refundedAt || order.paidAt || order.createdAt
          : order.status === "cancelled"
            ? order.cancelledAt || order.createdAt
            : order.createdAt,
    );
  const within = (day, from, to) => !!day && (!from || day >= from) && (!to || day <= to);

  function snapshot(state, eventId, from = "", to = "", locale = "vi") {
    if (!(state.events || []).some((event) => event.id === eventId))
      return { error: labels(locale).badEvent };
    if ((from && !validDay(from)) || (to && !validDay(to)) || (from && to && from > to))
      return { error: labels(locale).badDate };
    const orders = (state.orders || []).filter(
      (order) => order.eventId === eventId && within(orderDay(order), from, to),
    );
    const expenses = FrogExpenses.entries(state, eventId).filter(
      (expense) => !expense.archived && within(expense.date, from, to),
    );
    const expenseTotal = expenses.reduce((total, expense) => total + expense.amount, 0);
    return {
      eventId,
      from,
      to,
      orders,
      expenses,
      totals: FrogOrders.financialTotals(orders, expenseTotal),
    };
  }
  function cell(value) {
    if (typeof value === "number") return String(value);
    let text = String(value ?? "");
    if (/^[\s\x00-\x1f]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(kind, data, locale = "vi") {
    if (data.error) throw Error(data.error);
    const en = locale === "en";
    let columns, rows;
    if (kind === "orders") {
      columns = en
        ? ["Order ID", "Date", "Customer", "Status", "Method", "Ticket", "Items", "Total (VND)"]
        : [
            "Mã đơn",
            "Ngày",
            "Khách hàng",
            "Trạng thái",
            "Thanh toán",
            "Mã vé",
            "Sản phẩm",
            "Tổng (VND)",
          ];
      rows = data.orders.map((order) => [
        order.id,
        orderDay(order),
        order.customer,
        order.status,
        order.method,
        order.ticketId,
        order.items.map((item) => (item.name || item.productId) + " x" + item.qty).join("; "),
        order.items.reduce((sum, item) => sum + item.qty * item.price, 0),
      ]);
    } else if (kind === "revenue") {
      columns = en
        ? [
            "Payment date",
            "Order ID",
            "Customer",
            "SKU",
            "Item",
            "Category",
            "Quantity",
            "Price (VND)",
            "Revenue (VND)",
            "Cost (VND)",
          ]
        : [
            "Ngày thanh toán",
            "Mã đơn",
            "Khách hàng",
            "SKU",
            "Sản phẩm",
            "Nhóm",
            "Số lượng",
            "Đơn giá (VND)",
            "Doanh thu (VND)",
            "Giá vốn (VND)",
          ];
      rows = data.orders
        .filter((order) => order.status === "paid")
        .flatMap((order) =>
          order.items.map((item) => [
            orderDay(order),
            order.id,
            order.customer,
            item.productId,
            item.name || item.productId,
            item.category,
            item.qty,
            item.price,
            item.qty * item.price,
            Number.isFinite(item.cost) ? item.qty * item.cost : "",
          ]),
        );
    } else if (kind === "expenses") {
      columns = en
        ? ["Date", "Expense ID", "Category", "Description", "Amount (VND)"]
        : ["Ngày", "Mã chi phí", "Nhóm", "Mô tả", "Số tiền (VND)"];
      rows = data.expenses.map((e) => [e.date, e.id, e.category, e.description, e.amount]);
    } else throw Error("Invalid export type");
    return (
      "\uFEFFsep=,\r\n" +
      [columns, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
      "\r\n"
    );
  }
  function controls(from = "", to = "", locale = "vi") {
    const l = labels(locale);
    const picker = (key, value, title) =>
      '<label class="report-date">' +
      title +
      '<input class="field" type="date" id="report-' +
      key +
      '" value="' +
      (validDay(value) ? value : "") +
      '" /></label>';
    const buttons = ["orders", "revenue", "expenses"]
      .map(
        (kind) =>
          '<button type="button" class="btn secondary" data-act="report-export:' +
          kind +
          '">' +
          l[kind] +
          "</button>",
      )
      .join("");
    return (
      '<section class="panel report-tools"><div class="report-range">' +
      picker("from", from, l.from) +
      picker("to", to, l.to) +
      '<button type="button" class="btn secondary" data-act="report-clear">' +
      l.clear +
      '</button></div><div class="report-exports"><strong>' +
      l.export +
      "</strong>" +
      buttons +
      '</div><p class="report-note">' +
      l.scope +
      " " +
      l.snapshot +
      "</p></section>"
    );
  }
  globalThis.FrogReporting = { labels, dayKey, orderDay, validDay, snapshot, csv, controls };
})();
