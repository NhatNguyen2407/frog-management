(() => {
  "use strict";

  const storageKey = "frog-management-prototype-v1";
  const search = new URLSearchParams(location.search);
  const orderId = search.get("order");
  const mode = ["both", "customer", "staff"].includes(search.get("mode"))
    ? search.get("mode")
    : "both";

  let state;
  try {
    state = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    state = null;
  }

  const pages = document.querySelector("#print-pages");
  const printButton = document.querySelector("#print-button");
  const warning = document.querySelector("#print-warning");
  const customer = globalThis.FrogCustomerBill.renderBill(state, orderId);
  const staff = globalThis.FrogStaffSlip.renderStaffSlip(state, orderId);

  if (!customer || !staff) {
    pages.textContent = "Không tìm thấy đơn hàng demo.";
    printButton.disabled = true;
    return;
  }

  const content = [];
  if (mode !== "staff") content.push('<article class="sheet">' + customer + "</article>");
  if (mode !== "customer") content.push('<article class="sheet">' + staff + "</article>");
  pages.innerHTML = content.join("");
  document.title = "Frog - " + orderId + " - " + mode;

  const checkFit = () => {
    const overflow = [...pages.querySelectorAll(".sheet")].some(
      (page) => page.scrollHeight > page.clientHeight + 2,
    );
    warning.hidden = !overflow;
    warning.textContent = overflow
      ? "Nội dung dài hơn khổ tem 76 × 130 mm. Chưa thể in; cần rút gọn ghi chú hoặc chọn mẫu dài hơn."
      : "";
    printButton.disabled = overflow;
  };

  requestAnimationFrame(checkFit);
  document.fonts?.ready?.then(checkFit);
  window.addEventListener("resize", checkFit);
  printButton.addEventListener("click", () => {
    checkFit();
    if (!printButton.disabled) window.print();
  });
  document.querySelector("#close-button").addEventListener("click", () => window.close());
})();
