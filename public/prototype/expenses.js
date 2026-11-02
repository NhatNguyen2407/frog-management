(() => {
  "use strict";
  const words = {
    vi: { title:"Chi phí workshop", add:"Thêm chi phí", edit:"Sửa", archive:"Hủy ghi nhận",
      restore:"Khôi phục", date:"Ngày", category:"Loại", amount:"Số tiền", description:"Mô tả",
      action:"Thao tác", empty:"Chưa có khoản chi.", total:"Tổng chi phí", rent:"Mặt bằng",
      supplies:"Vật tư", staffing:"Nhân sự", other:"Khác", save:"Lưu chi phí", voided:"Đã hủy",
      eventError:"Không tìm thấy workshop.", missing:"Không tìm thấy khoản chi.",
      dateError:"Ngày không hợp lệ.", amountError:"Số tiền phải là số nguyên VND lớn hơn 0.",
      categoryError:"Loại chi phí không hợp lệ.", descriptionError:"Mô tả phải dài 2-120 ký tự.",
      statusError:"Trạng thái khoản chi không hợp lệ." },
    en: { title:"Workshop expenses", add:"Add expense", edit:"Edit", archive:"Void",
      restore:"Restore", date:"Date", category:"Category", amount:"Amount", description:"Description",
      action:"Action", empty:"No expense records.", total:"Total expenses", rent:"Rent",
      supplies:"Supplies", staffing:"Staffing", other:"Other", save:"Save expense", voided:"Voided",
      eventError:"Workshop not found.", missing:"Expense not found.",
      dateError:"Invalid date.", amountError:"Amount must be a positive whole VND value.",
      categoryError:"Invalid category.", descriptionError:"Description must be 2-120 characters.",
      statusError:"Invalid expense status." }
  };
  const labels = locale => words[locale === "en" ? "en" : "vi"];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const money = value => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date + "T00:00:00Z")) &&
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
  const dayKey = input => {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Ho_Chi_Minh",
      year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
    const get = key => parts.find(part => part.type === key)?.value;
    return [get("year"), get("month"), get("day")].join("-");
  };
  const addDays = (day, count) => {
    const date = new Date(day + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
  };
  function ensure(state) {
    if (!Array.isArray(state.expenses)) {
      state.expenses = [];
      for (const event of state.events || []) {
        if (!Number.isSafeInteger(event.expense) || event.expense < 1) continue;
        state.expenses.push({ id:"EX-" + String(state.expenses.length + 1).padStart(5, "0"),
          eventId:event.id, date:validDate(event.date) ? event.date : dayKey(new Date()),
          category:"other", amount:event.expense, description:"Initial demo operating cost",
          archived:false, legacy:true });
      }
    }
    const last = state.expenses.reduce((max, expense) => {
      const match = /^EX-(\d+)$/.exec(expense.id || "");
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    state.nextExpense = Math.max(last + 1,
      Number.isSafeInteger(state.nextExpense) ? state.nextExpense : 1);
    return state.expenses;
  }
  const entries = (state, eventId) => ensure(state).filter(e => e.eventId === eventId);
  const total = (state, eventId) => entries(state, eventId)
    .filter(e => !e.archived).reduce((sum, e) => sum + e.amount, 0);

  function validate(state, eventId, input, locale = "vi") {
    const l = labels(locale);
    if (!(state.events || []).some(e => e.id === eventId)) return { error:l.eventError };
    const date = String(input.date ?? "").trim();
    const amountStr = String(input.amount ?? "").trim();
    const amount = Number(amountStr);
    const category = String(input.category ?? "").trim();
    const description = String(input.description ?? "").trim();
    if (!validDate(date)) return { error:l.dateError };
    if (!/^\d+$/.test(amountStr) || !Number.isSafeInteger(amount) || amount <= 0)
      return { error:l.amountError };
    if (!["rent", "supplies", "staffing", "other"].includes(category))
      return { error:l.categoryError };
    if (description.length < 2 || description.length > 120) return { error:l.descriptionError };
    return { data:{date, amount, category, description} };
  }
  function save(state, eventId, values, id = null, at = new Date().toISOString(), locale = "vi") {
    const result = validate(state, eventId, values, locale);
    if (result.error) return result;
    const record = id ? entries(state, eventId).find(e => e.id === id) : null;
    if (id && !record) return { error:labels(locale).missing };
    if (record?.archived) return { error:labels(locale).statusError };
    if (record) {
      Object.assign(record, result.data, {updatedAt:at});
      return { expense:record };
    }
    ensure(state);
    const expense = { id:"EX-" + String(state.nextExpense++).padStart(5, "0"),
      eventId, ...result.data, archived:false, createdAt:at };
    state.expenses.push(expense);
    return { expense };
  }
  function setArchived(state, eventId, id, archived, locale = "vi") {
    const record = entries(state, eventId).find(e => e.id === id);
    if (!record) return { error:labels(locale).missing };
    if (!!record.archived === archived) return { error:labels(locale).statusError };
    record.archived = archived;
    record.updatedAt = new Date().toISOString();
    return { expense:record };
  }

  function dailySales(orders, at = new Date()) {
    const paid = orders.filter(order => order.status === "paid");
    const today = dayKey(at), cutoff = addDays(today, -6);
    const active = paid.some(order => {
      const key = dayKey(order.paidAt || order.createdAt);
      return key >= cutoff && key <= today;
    });
    const keys = paid.map(order => dayKey(order.paidAt || order.createdAt)).filter(Boolean).sort();
    const end = active || !keys.length ? today : keys[keys.length - 1];
    const start = addDays(end, -6), amounts = new Map();
    for (const order of paid) {
      const day = dayKey(order.paidAt || order.createdAt);
      if (day < start || day > end) continue;
      const sum = order.items.reduce((total, item) => total + item.qty * item.price, 0);
      amounts.set(day, (amounts.get(day) || 0) + sum);
    }
    return { start, end, historical:!active && keys.length > 0,
      days:Array.from({length:7}, (_, i) => {
        const day = addDays(start, i);
        const [, month, date] = day.split("-");
        return { date:day, label:date + "/" + month, value:amounts.get(day) || 0 };
      })
    };
  }

  function editor(expense = null, locale = "vi", today = dayKey(new Date())) {
    const l = labels(locale);
    const field = (name, type, label, value, extra = "") =>
      '<label class="form-field"><span>' + l[label] +
      '</span><input class="field" type="' + type + '" name="' + name +
      '" value="' + escape(value) + '" ' + extra + ' required /></label>';
    return '<h2>' + (expense ? l.edit : l.add) + '</h2><form id="expense-form">' +
      field("date", "date", "date", expense?.date || today) +
      '<label class="form-field"><span>' + l.category + '</span><select name="category" class="field">' +
      ["rent","supplies","staffing","other"].map(key => '<option value="' + key +
        '"' + ((expense?.category || "other") === key ? " selected" : "") +
        '>' + l[key] + '</option>').join("") + '</select></label>' +
      field("amount", "number", "amount", expense?.amount || "", 'min="1" step="1"') +
      field("description", "text", "description", expense?.description || "", 'maxlength="120"') +
      '<p id="expense-error" class="expense-error" role="alert" hidden></p>' +
      '<div class="modal-footer"><button type="submit" class="btn">' + l.save +
      '</button></div></form>';
  }
  function view(state, eventId, locale = "vi") {
    const l = labels(locale);
    const table = entries(state, eventId).slice().reverse().map(e => {
      const buttons = e.archived ? '<button class="btn secondary small" data-act="expense-restore:' +
        escape(e.id) + '">' + l.restore + '</button>' :
        '<button class="btn secondary small" data-act="expense-edit:' + escape(e.id) +
        '">' + l.edit + '</button> ' +
        '<button class="btn secondary small" data-act="expense-archive:' + escape(e.id) +
        '">' + l.archive + '</button>';
      return '<tr><td>' + escape(e.date.split("-").reverse().join("/")) + '</td><td>' +
        escape(l[e.category] || e.category) + '</td><td>' + escape(e.description) +
        '</td><td><strong>' + money(e.amount) + '</strong>' +
        (e.archived ? '<small>' + l.voided + '</small>' : "") +
        '</td><td>' + buttons + '</td></tr>';
    }).join("");
    return '<section class="panel expense-panel"><div class="panel-head">' +
      '<h3>' + l.title + '</h3><div class="expense-controls"><strong>' + l.total +
      ': ' + money(total(state, eventId)) + '</strong>' +
      '<button class="btn soft small" data-act="expense-new">＋ ' + l.add +
      '</button></div></div><div class="table-scroll"><table class="data-table"><thead><tr>' +
      [l.date,l.category,l.description,l.amount,l.action].map(x=>'<th>'+x+'</th>').join("") +
      '</tr></thead><tbody>' + (table || '<tr><td colspan="5">' + l.empty +
      '</td></tr>') + '</tbody></table></div></section>';
  }
  globalThis.FrogExpenses = { ensure, entries, total, validate, save, setArchived, dailySales,
    editor, view, dayKey };
})();
