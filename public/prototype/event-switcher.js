(() => {
  "use strict";

  const labels = {
    vi: { caption: "Sự kiện", choose: "Chọn sự kiện", active: "Đang mở", planned: "Dự kiến", other: "Sự kiện", empty: "Chưa có sự kiện" },
    en: { caption: "Event", choose: "Choose event", active: "Active", planned: "Planned", other: "Event", empty: "No events" }
  };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );

  function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    return match ? match[3] + "/" + match[2] + "/" + match[1] : "";
  }

  function render(events, selectedId, locale = "vi") {
    const l = labels[locale === "en" ? "en" : "vi"];
    const selected = events.find(event => event.id === selectedId) || events[0];
    const optionHtml = events.map(event => {
      const active = selected?.id === event.id;
      const status = event.status === "active" ? l.active : event.status === "planned" ? l.planned : l.other;
      const date = formatDate(event.date);
      return '<button type="button" class="event-option' + (active ? ' is-selected' : '') +
        '" role="menuitemradio" aria-checked="' + String(active) + '" data-event-option="' +
        escapeHtml(event.id) + '" tabindex="-1">' +
        '<span class="event-option-copy"><strong>' + escapeHtml(event.name) + '</strong>' +
        '<small>' + escapeHtml([date, status].filter(Boolean).join(" · ")) + '</small></span>' +
        (active ? '<span class="event-option-check" aria-hidden="true">✓</span>' : '') +
        '</button>';
    }).join("");

    return '<button type="button" id="event-switcher-trigger" class="event-trigger" aria-haspopup="menu"' +
      ' aria-controls="event-switcher-menu" aria-expanded="false" aria-label="' +
      escapeHtml(l.choose + ": " + (selected?.name || l.empty)) + '">' +
      '<span class="event-trigger-mark" aria-hidden="true"></span>' +
      '<span class="event-trigger-copy"><small>' + escapeHtml(l.caption) + '</small><strong>' +
      escapeHtml(selected?.name || l.empty) + '</strong></span>' +
      '<span class="event-trigger-chevron" aria-hidden="true"></span></button>' +
      '<div class="event-menu" id="event-switcher-menu" role="menu" aria-label="' +
      escapeHtml(l.choose) + '" hidden>' +
      '<div class="event-menu-title">' + escapeHtml(l.choose) + '</div>' +
      (optionHtml || '<p class="event-menu-empty">' + escapeHtml(l.empty) + '</p>') + '</div>';
  }

  globalThis.FrogEventSwitcher = { render };
})();
