// UNTANGLED – Phase 1 (salons & barbershops)
// Bookings, staff, service menu, walk-ins, status, payments, WhatsApp reminders.
// Data lives in the browser (localStorage). No backend yet.

const KEYS = {
  bookings: "untangled.bookings",
  staff: "untangled.staff",
  services: "untangled.services",
};

const STATUSES = [
  ["booked", "Booked"],
  ["in-chair", "In chair"],
  ["done", "Done"],
  ["no-show", "No-show"],
];

// ---------- State ----------
function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function saveAll() {
  localStorage.setItem(KEYS.bookings, JSON.stringify(bookings));
  localStorage.setItem(KEYS.staff, JSON.stringify(staff));
  localStorage.setItem(KEYS.services, JSON.stringify(services));
}

let staff = loadJSON(KEYS.staff, ["Me"]);
let services = loadJSON(KEYS.services, [
  { name: "Haircut", price: 300 },
  { name: "Shave", price: 150 },
  { name: "Haircut + shave", price: 400 },
]);
let bookings = loadJSON(KEYS.bookings, []).map((b) => ({
  staff: staff[0], // older bookings from the first version had no staff/status
  status: "booked",
  ...b,
}));

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const kes = (n) => "KES " + Number(n).toLocaleString("en-KE");
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

// Builds elements with textContent (never innerHTML) so typed input can't inject HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 0712345678 or 0112345678 -> 254712345678 (format WhatsApp links need)
function toInternational(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  return "254" + digits;
}

function whatsappLink(b) {
  const msg =
    `Hi ${b.customer}, this is a reminder about your ${b.service} with ${b.staff} ` +
    `on ${fmtWhen(b.when)}. Amount: ${kes(b.price)}. Thank you!`;
  return `https://wa.me/${toInternational(b.phone)}?text=${encodeURIComponent(msg)}`;
}

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

// Value for a datetime-local input representing "right now" in local time.
function nowLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------- Booking actions ----------
function addBooking(data) {
  bookings.push({
    id: crypto.randomUUID(),
    customer: data.customer.trim(),
    phone: data.phone.trim(),
    service: data.service,
    staff: data.staff,
    when: data.walkIn ? nowLocalISO() : data.when,
    price: Number(data.price),
    status: data.walkIn ? "in-chair" : "booked",
    walkIn: data.walkIn,
    paid: false,
  });
  bookings.sort((a, b) => new Date(a.when) - new Date(b.when));
  saveAll();
  render();
}

function updateBooking(id, changes) {
  const b = bookings.find((x) => x.id === id);
  if (b) Object.assign(b, changes);
  saveAll();
  render();
}

function removeBooking(id) {
  if (!confirm("Delete this booking?")) return;
  bookings = bookings.filter((x) => x.id !== id);
  saveAll();
  render();
}

// ---------- Rendering: bookings ----------
function renderItem(b) {
  const cls = ["item", b.paid ? "paid" : "unpaid"];
  if (b.status === "no-show") cls.push("no-show");
  const li = el("li", cls.join(" "));

  li.append(el("h3", "", `${b.customer} – ${b.service}`));
  li.append(
    el(
      "p",
      "meta",
      `${b.walkIn ? "Walk-in · " : ""}${fmtWhen(b.when)} · ${b.staff} · ${kes(b.price)} · ${b.paid ? "Paid" : "Not paid"}`
    )
  );

  const actions = el("div", "actions");

  const status = el("select");
  status.setAttribute("aria-label", "Booking status");
  for (const [value, label] of STATUSES) {
    const opt = el("option", "", label);
    opt.value = value;
    opt.selected = b.status === value;
    status.append(opt);
  }
  status.addEventListener("change", () => updateBooking(b.id, { status: status.value }));

  const remind = el("a", "btn", "Remind on WhatsApp");
  remind.href = whatsappLink(b);
  remind.target = "_blank";
  remind.rel = "noopener";

  const pay = el("button", "ghost", b.paid ? "Mark as unpaid" : "Mark as paid");
  pay.addEventListener("click", () => updateBooking(b.id, { paid: !b.paid }));

  const del = el("button", "danger", "Delete");
  del.addEventListener("click", () => removeBooking(b.id));

  actions.append(status, remind, pay, del);
  li.append(actions);
  return li;
}

function renderStaffSummary() {
  const list = $("staff-summary");
  const today = bookings.filter((b) => isToday(b.when) && b.status !== "no-show");
  const names = [...new Set([...staff, ...today.map((b) => b.staff)])];

  list.replaceChildren(
    ...names.map((name) => {
      const mine = today.filter((b) => b.staff === name);
      const paid = mine.filter((b) => b.paid).reduce((s, b) => s + b.price, 0);
      const owed = mine.filter((b) => !b.paid).reduce((s, b) => s + b.price, 0);
      const li = el("li", "summary-row");
      li.append(el("strong", "", name));
      li.append(el("span", "", `${mine.length} clients · ${kes(paid)} paid · ${kes(owed)} owed`));
      return li;
    })
  );
}

function renderStats() {
  const live = bookings.filter((b) => b.status !== "no-show");
  const paid = live.filter((b) => b.paid).reduce((s, b) => s + b.price, 0);
  const unpaid = live.filter((b) => !b.paid).reduce((s, b) => s + b.price, 0);
  $("stat-today").textContent = bookings.filter((b) => isToday(b.when)).length;
  $("stat-paid").textContent = kes(paid);
  $("stat-unpaid").textContent = kes(unpaid);
}

// ---------- Rendering: setup + form selects ----------
function chip(label, onRemove) {
  const li = el("li", "chip");
  li.append(el("span", "", label));
  const x = el("button", "chip-x", "×");
  x.setAttribute("aria-label", "Remove " + label);
  x.addEventListener("click", onRemove);
  li.append(x);
  return li;
}

function renderSetup() {
  $("staff-list").replaceChildren(
    ...staff.map((name) =>
      chip(name, () => {
        if (staff.length === 1) return alert("Keep at least one staff member.");
        staff = staff.filter((s) => s !== name);
        saveAll();
        render();
      })
    )
  );
  $("service-list").replaceChildren(
    ...services.map((s) =>
      chip(`${s.name} – ${kes(s.price)}`, () => {
        services = services.filter((x) => x.name !== s.name);
        saveAll();
        render();
      })
    )
  );
}

function fillSelect(select, values) {
  const previous = select.value;
  select.replaceChildren(
    ...values.map((v) => {
      const opt = el("option", "", v);
      opt.value = v;
      return opt;
    })
  );
  if (values.includes(previous)) select.value = previous;
}

function renderFormOptions() {
  fillSelect($("service"), services.map((s) => s.name));
  fillSelect($("staff"), staff);
  if (!$("price").value) syncPrice();
}

// Picking a service fills in its menu price (you can still change it).
function syncPrice() {
  const s = services.find((x) => x.name === $("service").value);
  if (s) $("price").value = s.price;
}

function render() {
  $("booking-list").replaceChildren(...bookings.map(renderItem));
  $("empty").hidden = bookings.length > 0;
  renderStats();
  renderStaffSummary();
  renderSetup();
  renderFormOptions();
}

// ---------- Wiring ----------
$("service").addEventListener("change", syncPrice);

$("walkin").addEventListener("change", () => {
  const walkIn = $("walkin").checked;
  $("when-label").hidden = walkIn;
  $("when").required = !walkIn;
});

$("booking-form").addEventListener("submit", (e) => {
  e.preventDefault();
  addBooking({
    customer: $("customer").value,
    phone: $("phone").value,
    service: $("service").value,
    staff: $("staff").value,
    when: $("when").value,
    price: $("price").value,
    walkIn: $("walkin").checked,
  });
  e.target.reset();
  $("when-label").hidden = false;
  $("when").required = true;
  $("price").value = "";
  render();
});

$("staff-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("new-staff").value.trim();
  if (name && !staff.includes(name)) staff.push(name);
  e.target.reset();
  saveAll();
  render();
});

$("service-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("new-service").value.trim();
  if (name && !services.some((s) => s.name === name)) {
    services.push({ name, price: Number($("new-price").value) });
  }
  e.target.reset();
  saveAll();
  render();
});

render();
