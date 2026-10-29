(() => {
  "use strict";
  const labels = {
    vi: {
      title: "Sản phẩm",
      desc: "Quản lý danh mục sản phẩm và giá bán.",
      add: "Thêm sản phẩm",
      search: "Tìm tên hoặc SKU...",
      all: "Tất cả",
      active: "Đang bán",
      archived: "Đã ẩn",
      name: "Tên sản phẩm",
      sku: "SKU",
      category: "Danh mục",
      workshop: "Workshop",
      food: "Đồ ăn & uống",
      price: "Giá bán (VND)",
      cost: "Giá vốn (VND)",
      stock: "Tồn kho",
      edit: "Sửa",
      hide: "Ẩn",
      restore: "Khôi phục",
      cancel: "Hủy",
      save: "Lưu sản phẩm",
      empty: "Không tìm thấy sản phẩm.",
      help: "Sản phẩm đã bán chỉ được ẩn, không xóa. Tồn kho chỉnh trong Kho hàng.",
      confirmation: "Ẩn sản phẩm khỏi quầy bán hàng?",
      confirm: "Xác nhận",
      duplicate: "SKU đã tồn tại.",
      invalidSku: "SKU phải có 2-32 ký tự A-Z, 0-9 hoặc -.",
      invalidName: "Tên sản phẩm không hợp lệ (1-100 ký tự).",
      invalidCategory: "Danh mục không hợp lệ.",
      invalidMoney: "Giá phải là số nguyên VND không âm.",
      lockedSku: "Không được thay đổi SKU đã tạo.",
    },
    en: {
      title: "Products",
      desc: "Manage products and selling prices.",
      add: "Add product",
      search: "Search name or SKU...",
      all: "All",
      active: "Active",
      archived: "Archived",
      name: "Product name",
      sku: "SKU",
      category: "Category",
      workshop: "Workshop",
      food: "Food & drinks",
      price: "Price (VND)",
      cost: "Unit cost (VND)",
      stock: "Stock",
      edit: "Edit",
      hide: "Archive",
      restore: "Restore",
      cancel: "Cancel",
      save: "Save product",
      empty: "No matching products.",
      help: "Archive sold items instead of deleting. Manage stock in Inventory.",
      confirmation: "Hide this product from the register?",
      confirm: "Confirm",
      duplicate: "This SKU already exists.",
      invalidSku: "SKU must be 2-32 characters: A-Z, 0-9 or -.",
      invalidName: "Product name must be 1-100 characters.",
      invalidCategory: "Invalid category.",
      invalidMoney: "Prices must be non-negative whole VND amounts.",
      lockedSku: "Existing SKUs cannot be changed.",
    },
  };
  const getLabels = (locale) => labels[locale === "en" ? "en" : "vi"];
  function validate(raw, products, original = null, locale = "vi") {
    const l = getLabels(locale),
      id = String(raw.id ?? "")
        .trim()
        .toUpperCase(),
      name = String(raw.name ?? "").trim();
    const validMoney = (x) =>
      /^\d+$/.test(String(x ?? "").trim()) && Number.isSafeInteger(Number(x));
    if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(id)) return { error: l.invalidSku };
    if (original && id !== original) return { error: l.lockedSku };
    if (!original && products.some((p) => p.id.toUpperCase() === id)) return { error: l.duplicate };
    if (!name || name.length > 100) return { error: l.invalidName };
    if (!["workshop", "food"].includes(raw.category)) return { error: l.invalidCategory };
    if (!validMoney(raw.price) || !validMoney(raw.cost)) return { error: l.invalidMoney };
    return {
      data: { id, name, category: raw.category, price: Number(raw.price), cost: Number(raw.cost) },
    };
  }
  function view(products, locale, esc, money, query = "", filter = "active") {
    const l = getLabels(locale);
    const filtered = products.filter(
      (p) =>
        (filter === "all" || (p.active === false ? filter === "archived" : filter === "active")) &&
        `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()),
    );
    return `<div class="catalog-toolbar"><input class="search" id="catalog-search" aria-label="${l.search}" placeholder="${l.search}" value="${esc(query)}"/>
      <div class="filter-row">${["active", "all", "archived"].map((key) => `<button type="button" class="filter ${filter === key ? "active" : ""}" data-act="catalog-filter:${key}">${l[key]}</button>`).join("")}</div></div>
      <section class="panel"><div class="table-scroll"><table class="data-table"><thead><tr>
      <th>${l.name}</th><th>${l.sku}</th><th>${l.category}</th><th>${l.price}</th><th>${l.cost}</th><th>${l.stock}</th><th></th>
      </tr></thead><tbody>${
        filtered
          .map(
            (
              p,
            ) => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.id)}</td><td>${l[p.category]}</td>
      <td>${money(p.price)}</td><td>${money(p.cost)}</td><td>${p.stock}</td><td><div class="flex">
      <button class="btn secondary small" type="button" data-act="catalog-edit:${esc(p.id)}">${l.edit}</button>
      <button class="btn ${p.active === false ? "soft" : "secondary"} small" type="button" data-act="catalog-toggle:${esc(p.id)}">${p.active === false ? l.restore : l.hide}</button>
      </div></td></tr>`,
          )
          .join("") || `<tr><td colspan="7">${l.empty}</td></tr>`
      }</tbody></table></div></section>
      <p class="catalog-hint">${l.help}</p>`;
  }
  function editor(product, locale, esc) {
    const l = getLabels(locale),
      edit = Boolean(product);
    const field = (key, label, value, type = "text", extra = "") =>
      `<label class="form-field"><span>${label}</span><input class="field" name="${key}" type="${type}" value="${esc(value)}" ${extra} required /></label>`;
    const option = (key) =>
      `<option value="${key}" ${product?.category === key ? "selected" : ""}>${l[key]}</option>`;
    return `<h2>${edit ? l.edit : l.add}</h2><form id="catalog-form" class="catalog-form">
      ${field("id", l.sku, product?.id || "", "text", edit ? "readonly" : 'maxlength="32" placeholder="WS-NEW-001"')}
      ${field("name", l.name, product?.name || "", "text", 'maxlength="100"')}
      <label class="form-field"><span>${l.category}</span><select name="category" class="field">${option("workshop")}${option("food")}</select></label>
      <div class="form-grid">${field("price", l.price, product?.price ?? 0, "number", 'min="0" step="1"')}
        ${field("cost", l.cost, product?.cost ?? 0, "number", 'min="0" step="1"')}</div>
      <p class="catalog-hint">${l.help}</p><p id="catalog-error" class="catalog-error" role="alert" hidden></p>
      <div class="modal-footer"><button class="btn secondary" type="button" data-act="close">${l.cancel}</button><button class="btn" type="submit">${l.save}</button></div>
      </form>`;
  }
  globalThis.FrogCatalogue = { labels, validate, view, editor };
})();
