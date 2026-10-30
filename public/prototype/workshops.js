(() => {
  "use strict";

  const labels = {
    vi: {
      add: "Tạo workshop", edit: "Sửa", choose: "Chọn", selected: "Đang chọn",
      name: "Tên workshop", date: "Ngày tổ chức", prefix: "Mã vé (prefix)",
      capacity: "Sức chứa", status: "Trạng thái", active: "Đang mở", planned: "Dự kiến",
      registered: "Vé đã đăng ký", save: "Lưu workshop", cancel: "Hủy",
      help: "Mã vé không thể thay đổi sau khi tạo. Workshop không bị xóa để giữ lịch sử đơn hàng.",
      invalidName: "Tên workshop phải dài 2-80 ký tự.",
      invalidDate: "Ngày tổ chức không hợp lệ.",
      invalidPrefix: "Mã vé cần 2-10 ký tự A-Z hoặc 0-9.",
      duplicatePrefix: "Mã vé này đã được sử dụng.",
      invalidCapacity: "Sức chứa phải là số nguyên từ 1 đến 99999.",
      occupied: "Sức chứa không thể thấp hơn số vé còn hiệu lực.",
      invalidStatus: "Trạng thái workshop không hợp lệ.",
      invalidId: "Không tìm thấy workshop.",
      lockedPrefix: "Không được thay đổi mã vé của workshop đã tạo."
    },
    en: {
      add: "Create workshop", edit: "Edit", choose: "Select", selected: "Selected",
      name: "Workshop name", date: "Event date", prefix: "Ticket prefix",
      capacity: "Capacity", status: "Status", active: "Active", planned: "Planned",
      registered: "Registered tickets", save: "Save workshop", cancel: "Cancel",
      help: "Ticket prefix is locked after creation. Workshops cannot be deleted to preserve order history.",
      invalidName: "Workshop name must be 2-80 characters.",
      invalidDate: "Invalid workshop date.",
      invalidPrefix: "Ticket prefix must contain 2-10 A-Z or 0-9 characters.",
      duplicatePrefix: "Ticket prefix already exists.",
      invalidCapacity: "Capacity must be a whole number from 1 to 99999.",
      occupied: "Capacity cannot be lower than the number of active registrations.",
      invalidStatus: "Invalid workshop status.",
      invalidId: "Workshop not found.",
      lockedPrefix: "Cannot change an existing workshop ticket prefix."
    }
  };

  const lang = locale => labels[locale === "en" ? "en" : "vi"];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const registeredCount = (state, eventId) =>
    (state.tickets || []).filter(ticket =>
      ticket.eventId === eventId && ticket.status !== "cancelled"
    ).length;

  function validate(state, input, originalId = null, locale = "vi") {
    const l = lang(locale);
    const existing = originalId ? state.events.find(e => e.id === originalId) : null;
    if (originalId && !existing) return { error: l.invalidId };

    const name = String(input.name ?? "").trim();
    const date = String(input.date ?? "").trim();
    const prefix = String(input.prefix ?? "").trim().toUpperCase();
    const status = String(input.status ?? "").trim();
    const capacityText = String(input.capacity ?? "").trim();
    const capacity = Number(capacityText);

    if (name.length < 2 || name.length > 80) return { error: l.invalidName };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date + "T00:00:00Z")) ||
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
      return { error: l.invalidDate };
    if (!/^[A-Z0-9]{2,10}$/.test(prefix)) return { error: l.invalidPrefix };
    if (existing && existing.prefix !== prefix) return { error: l.lockedPrefix };
    if (state.events.some(event => event.id !== originalId && event.prefix === prefix))
      return { error: l.duplicatePrefix };
    if (!/^\d+$/.test(capacityText) || !Number.isSafeInteger(capacity) ||
        capacity < 1 || capacity > 99999) return { error: l.invalidCapacity };
    if (!["active", "planned"].includes(status)) return { error: l.invalidStatus };
    if (existing && capacity < registeredCount(state, originalId)) return { error: l.occupied };

    return { data: { name, date, prefix, capacity, status } };
  }

  function save(state, input, originalId = null, locale = "vi") {
    const result = validate(state, input, originalId, locale);
    if (result.error) return result;

    if (originalId) {
      const event = state.events.find(item => item.id === originalId);
      // Preserve the event details already printed on historical order receipts.
      for (const order of state.orders || []) {
        if (order.eventId !== originalId) continue;
        if (order.eventName === undefined) order.eventName = event.name;
        if (order.eventDate === undefined) order.eventDate = event.date;
      }
      Object.assign(event, result.data);
      return { event };
    }

    const id = "event-" + result.data.prefix.toLowerCase();
    if (state.events.some(event => event.id === id))
      return { error: lang(locale).duplicatePrefix };

    const event = { id, ...result.data, expense: 0 };
    state.events.push(event);
    state.nextTicket ||= {};
    state.nextTicket[id] = 1;
    return { event };
  }

  const displayDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? match[3] + "/" + match[2] + "/" + match[1] : value;
  };

  function list(state, locale = "vi", allowEdit = false) {
    const l = lang(locale);
    return '<div class="event-grid">' + state.events.map(event => {
      const used = registeredCount(state, event.id);
      const selected = event.id === state.selectedEvent;
      return '<section class="panel event-card workshop-card">' +
        '<span class="date-box">' + escape(displayDate(event.date)) + '</span>' +
        '<div class="workshop-card-heading"><h3>' + escape(event.name) + '</h3>' +
        '<span class="workshop-state ' + (event.status === "active" ? "is-active" : "") +
        '">' + (l[event.status] || escape(event.status)) + '</span></div>' +
        '<p>' + escape(event.prefix) + ' · ' + l.registered + ': <b>' +
        used + ' / ' + event.capacity + '</b></p>' +
        '<div class="workshop-actions">' +
        (allowEdit ? '<button type="button" class="btn secondary small" data-act="workshop-edit:' +
          escape(event.id) + '">' + l.edit + '</button>' : '') +
        '<button type="button" class="btn ' + (selected ? "soft" : "secondary") +
        ' small" data-act="event:' + escape(event.id) + '" ' +
        (selected ? "disabled" : "") + '>' + (selected ? l.selected : l.choose) +
        '</button></div></section>';
    }).join("") + '</div>';
  }

  function editor(event = null, locale = "vi") {
    const l = lang(locale);
    const field = (key, label, value, type = "text", extra = "") =>
      '<label class="form-field"><span>' + label + '</span><input name="' + key +
      '" class="field" type="' + type + '" value="' + escape(value) + '" ' +
      extra + ' required /></label>';
    return '<h2>' + (event ? l.edit : l.add) + '</h2>' +
      '<form id="workshop-form" class="workshop-form">' +
      field("name", l.name, event?.name || "", "text", 'maxlength="80"') +
      '<div class="form-grid">' +
      field("date", l.date, event?.date || "", "date") +
      field("capacity", l.capacity, event?.capacity ?? 20, "number", 'min="1" max="99999" step="1"') +
      '</div>' + field("prefix", l.prefix, event?.prefix || "", "text",
        event ? "readonly" : 'maxlength="10" placeholder="FROG"') +
      '<label class="form-field"><span>' + l.status + '</span><select name="status" class="field">' +
      ["active", "planned"].map(key => '<option value="' + key + '"' +
        ((event?.status || "planned") === key ? ' selected' : '') +
        '>' + l[key] + '</option>').join("") + '</select></label>' +
      '<p class="workshop-help">' + l.help + '</p>' +
      '<p id="workshop-error" role="alert" class="workshop-error" hidden></p>' +
      '<div class="modal-footer"><button type="button" class="btn secondary" data-act="close">' +
      l.cancel + '</button><button type="submit" class="btn">' + l.save +
      '</button></div></form>';
  }

  globalThis.FrogWorkshops = { labels, registeredCount, validate, save, list, editor };
})();
