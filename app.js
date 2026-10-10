// UNTANGLED – Phase 1 (salons & barbershops)
// Bookings, staff, service menu, staff-services, durations, double-booking
// protection, walk-ins, status, cash/M-Pesa payments, free-time view and
// WhatsApp reminders.
//
// All data goes through store.js. When we choose a backend, only store.js changes.
// Look for "[STAFF]" comments: everything to do with staff.

const STATUSES = [
  ["booked", "Booked"],
  ["in-chair", "In chair"],
  ["done", "Done"],
  ["no-show", "No-show"],
];

const MIN_GAP_MINUTES = 30; // free gaps shorter than this aren't shown
const MPESA_CODE = /^[A-Z0-9]{10}$/; // M-Pesa codes are 10 letters/digits

// ======================================================================
// State: a copy of what's in the store, refreshed after every change
// ======================================================================

let bookings = [];
let staff = [];
let services = [];
let settings = { open: "08:00", close: "19:00" };

async function refresh() {
  ({ bookings, staff, services, settings } = await store.loadAll());
  render();
}

// Runs a change, then reloads and redraws. One place to handle failures.
async function run(action) {
  try {
    await action();
    await refresh();
  } catch (err) {
    console.error(err);
    alert("Something went wrong and your change was not saved. Please try again.");
  }
}

// ======================================================================
// Helpers
// ======================================================================

const $ = (id) => document.getElementById(id);
const kes = (n) => "KES " + Number(n).toLocaleString("en-KE");
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("en-KE", { timeStyle: "short" });

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

// [STAFF] Who can do this service?
const staffFor = (serviceName) => staff.filter((s) => s.services.includes(serviceName));

// Two bookings clash when each starts before the other ends.
const startMs = (b) => new Date(b.when).getTime();
const endMs = (b) => startMs(b) + b.duration * 60000;

function findClash(staffName, whenISO, duration) {
  const start = new Date(whenISO).getTime();
  const end = start + duration * 60000;
  return bookings.find(
    (b) => b.staff === staffName && b.status !== "no-show" && start < endMs(b) && end > startMs(b)
  );
}

// Free time left today for one person: gaps between bookings, from now until closing.
// No-shows don't block time, so a no-show shows up as a gap you can fill.
function freeSlots(staffName) {
  const at = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const closing = at(settings.close);
  const minGap = MIN_GAP_MINUTES * 60000;

  let cursor = Math.max(at(settings.open), Date.now());
  const gaps = [];
  const mine = bookings
    .filter((b) => b.staff === staffName && isToday(b.when) && b.status !== "no-show")
    .sort((a, b) => startMs(a) - startMs(b));

  for (const b of mine) {
    if (startMs(b) - cursor >= minGap) gaps.push([cursor, startMs(b)]);
    cursor = Math.max(cursor, endMs(b));
  }
  if (closing - cursor >= minGap) gaps.push([cursor, closing]);
  return gaps;
}

const payLabel = (b) =>
  !b.paid ? "Not paid" : b.payMethod === "mpesa" ? `Paid · M-Pesa ${b.mpesaCode}` : b.payMethod === "cash" ? "Paid · Cash" : "Paid";

// ======================================================================
// Actions (each one goes through run(): change the store, then redraw)
// ======================================================================

// Returns { ok, message }. Clashes block scheduled bookings; walk-ins can override.
async function addBooking(data) {
  const when = data.walkIn ? nowLocalISO() : data.when;
  const duration = Number(data.duration);

  const clash = findClash(data.staff, when, duration);
  if (clash) {
    const msg = `${data.staff} is busy with ${clash.customer} (${fmtWhen(clash.when)}, ${clash.duration} min).`;
    if (!data.walkIn) {
      return { ok: false, message: msg + " Pick another time or another staff member." };
    }
    if (!confirm(msg + " Add this walk-in anyway?")) return { ok: false };
  }

  await store.addBooking({
    id: crypto.randomUUID(),
    customer: data.customer.trim(),
    phone: data.phone.trim(),
    service: data.service,
    staff: data.staff,
    when,
    duration,
    price: Number(data.price),
    status: data.walkIn ? "in-chair" : "booked",
    walkIn: data.walkIn,
    paid: false,
    payMethod: null,
    mpesaCode: "",
  });
  return { ok: true };
}

const updateBooking = (id, changes) => run(() => store.updateBooking(id, changes));

function removeBooking(id) {
  if (confirm("Delete this booking?")) run(() => store.removeBooking(id));
}

// [STAFF] Staff actions
function addStaff(name) {
  if (name) run(() => store.addStaff(name));
}

function removeStaff(name) {
  if (staff.length === 1) return alert("Keep at least one staff member.");
  run(() => store.removeStaff(name));
}

// Ticking a box shouldn't redraw the whole setup panel (you'd lose your place),
// so we only reload the data and refresh the booking form's dropdowns.
async function setStaffService(member, serviceName, does) {
  try {
    await store.setStaffService(member.name, serviceName, does);
    ({ staff } = await store.loadAll());
    renderFormOptions();
  } catch (err) {
    console.error(err);
    alert("Couldn't save that change. Please try again.");
  }
}

const addService = (name, price, duration) =>
  name && run(() => store.addService({ name, price, duration }));
const removeService = (name) => run(() => store.removeService(name));

// ======================================================================
// Payment dialog
// ======================================================================

let payingId = null;

function openPayDialog(b) {
  payingId = b.id;
  $("pay-summary").textContent = `${b.customer} – ${b.service} – ${kes(b.price)}`;
  $("pay-method").value = "cash";
  $("pay-code").value = "";
  $("pay-code-label").hidden = true;
  $("pay-code").required = false;
  $("pay-dialog").showModal();
}

function savePayment() {
  const method = $("pay-method").value;
  const code = $("pay-code").value.trim().toUpperCase();

  if (method === "mpesa") {
    if (!MPESA_CODE.test(code)) {
      return alert("Enter the 10-character M-Pesa code from the SMS, e.g. SJK3L9XY2P.");
    }
    // The same SMS can't pay for two bookings.
    const used = bookings.find((b) => b.id !== payingId && b.mpesaCode === code);
    if (used) {
      return alert(`That M-Pesa code is already recorded for ${used.customer}'s ${used.service}.`);
    }
  }

  $("pay-dialog").close();
  updateBooking(payingId, {
    paid: true,
    payMethod: method,
    mpesaCode: method === "mpesa" ? code : "",
  });
}

// ======================================================================
// Rendering: bookings and summaries
// ======================================================================

function renderItem(b) {
  const cls = ["item", b.paid ? "paid" : "unpaid"];
  if (b.status === "no-show") cls.push("no-show");
  const li = el("li", cls.join(" "));

  li.append(el("h3", "", `${b.customer} – ${b.service}`));
  li.append(
    el(
      "p",
      "meta",
      `${b.walkIn ? "Walk-in · " : ""}${fmtWhen(b.when)} (${b.duration} min) · ${b.staff} · ${kes(b.price)} · ${payLabel(b)}`
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

  const pay = el("button", "ghost", b.paid ? "Mark as unpaid" : "Record payment");
  pay.addEventListener("click", () => {
    if (b.paid) updateBooking(b.id, { paid: false, payMethod: null, mpesaCode: "" });
    else openPayDialog(b);
  });

  const del = el("button", "danger", "Delete");
  del.addEventListener("click", () => removeBooking(b.id));

  actions.append(status, remind, pay, del);
  li.append(actions);
  return li;
}

function renderStaffSummary() {
  const today = bookings.filter((b) => isToday(b.when) && b.status !== "no-show");
  const names = [...new Set([...staff.map((s) => s.name), ...today.map((b) => b.staff)])];

  $("staff-summary").replaceChildren(
    ...names.map((name) => {
      const mine = today.filter((b) => b.staff === name);
      const paid = mine.filter((b) => b.paid).reduce((s, b) => s + b.price, 0);
      const owed = mine.filter((b) => !b.paid).reduce((s, b) => s + b.price, 0);
      const li = el("li", "summary-row");
      li.append(el("strong", "", name));
      li.append(el("span", "", `${mine.length} clients · ${kes(paid)} paid · ${kes(owed)} owed`));

      const gaps = freeSlots(name);
      li.append(
        el(
          "div",
          "free",
          gaps.length
            ? "Free: " + gaps.map(([a, b]) => `${fmtTime(a)}–${fmtTime(b)}`).join(", ")
            : "No free time left today"
        )
      );
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

// Cash vs M-Pesa for today, so the owner can match the till and the phone at closing.
function renderTakings() {
  const paidToday = bookings.filter((b) => isToday(b.when) && b.paid);
  const total = (method) =>
    paidToday.filter((b) => b.payMethod === method).reduce((s, b) => s + b.price, 0);
  $("takings").textContent = `Today's takings – Cash ${kes(total("cash"))} · M-Pesa ${kes(total("mpesa"))}`;
}

// ======================================================================
// Report: busy and quiet days
// ======================================================================

let reportDays = 30;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabel = (h) =>
  new Date(2000, 0, 1, h).toLocaleTimeString("en-KE", { hour: "numeric", hour12: true });

// Works out the numbers for the last `days` days. Returns null if there's nothing to show.
function buildReport(days) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const endToday = new Date(todayStart);
  endToday.setDate(endToday.getDate() + 1);
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const inRange = bookings.filter(
    (b) => startMs(b) >= rangeStart.getTime() && startMs(b) < endToday.getTime()
  );
  if (!inRange.length) return null;

  // Days before the first booking in this period are ignored, so a shop that
  // only just started using the app doesn't see empty days counted as "quiet".
  const first = new Date(Math.min(...inRange.map(startMs)));
  first.setHours(0, 0, 0, 0);

  const occurrences = Array(7).fill(0); // how many Mondays, Tuesdays... in the period
  let totalDays = 0;
  for (let d = new Date(first); d <= todayStart; d.setDate(d.getDate() + 1)) {
    occurrences[d.getDay()]++;
    totalDays++;
  }

  const live = inRange.filter((b) => b.status !== "no-show");
  const noShows = inRange.length - live.length;

  const weekdays = WEEK_ORDER.map((wd) => {
    const mine = live.filter((b) => new Date(b.when).getDay() === wd);
    const occ = occurrences[wd];
    return {
      wd,
      avg: occ ? mine.length / occ : null,
      value: occ ? mine.reduce((s, b) => s + b.price, 0) / occ : null,
    };
  });

  const hourCounts = {};
  for (const b of live) {
    const h = new Date(b.when).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const booked = Object.keys(hourCounts).map(Number);
  const [openH] = settings.open.split(":").map(Number);
  const [closeH, closeM] = settings.close.split(":").map(Number);
  const minH = Math.min(openH, ...booked);
  const maxH = Math.max(closeM ? closeH : closeH - 1, ...booked);
  const hours = [];
  for (let h = minH; h <= maxH; h++) hours.push({ h, count: hourCounts[h] || 0 });

  return { total: live.length, noShows, noShowRate: noShows / inRange.length, totalDays, weekdays, hours };
}

// Finds the highest and lowest row by `key`. Returns {} when there's no clear difference.
function extremes(rows, key) {
  const valid = rows.filter((r) => r[key] !== null);
  if (!valid.length) return {};
  const max = Math.max(...valid.map((r) => r[key]));
  const min = Math.min(...valid.map((r) => r[key]));
  if (max === min) return {};
  return { busiest: valid.find((r) => r[key] === max), quietest: valid.find((r) => r[key] === min) };
}

// Draws a simple bar chart out of divs. rows: [{ label, value, text, kind }]
function renderBars(list, rows) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  list.replaceChildren(
    ...rows.map((r) => {
      const li = el("li", "bar-row");
      li.append(el("span", "bar-label", r.label));
      const track = el("div", "bar");
      const fill = el("div", "bar-fill" + (r.kind ? " " + r.kind : ""));
      fill.style.width = (max ? (r.value / max) * 100 : 0) + "%";
      track.append(fill);
      li.append(track);
      li.append(el("span", "bar-val", r.text));
      return li;
    })
  );
}

function renderReport() {
  const r = buildReport(reportDays);
  $("report-empty").hidden = !!r;
  $("report-body").hidden = !r;
  if (!r) return;

  const wk = extremes(r.weekdays, "avg");
  const hr = extremes(r.hours, "count");
  const tag = (row, ext) =>
    row === ext.busiest ? " · busiest" : row === ext.quietest ? " · quietest" : "";
  const kind = (row, ext) =>
    row === ext.busiest ? "busy" : row === ext.quietest ? "quiet" : "";

  const facts = [
    `${r.total} bookings over ${r.totalDays} day${r.totalDays === 1 ? "" : "s"} (about ${(r.total / r.totalDays).toFixed(1)} a day)`,
    `${r.noShows} no-show${r.noShows === 1 ? "" : "s"} (${Math.round(r.noShowRate * 100)}% of bookings)`,
  ];
  if (wk.busiest) {
    facts.push(
      `Busiest day: ${WEEKDAY_NAMES[wk.busiest.wd]}`,
      `Quietest day: ${WEEKDAY_NAMES[wk.quietest.wd]}`
    );
  }
  if (hr.busiest) {
    facts.push(`Peak hour: ${hourLabel(hr.busiest.h)}`, `Quietest hour: ${hourLabel(hr.quietest.h)}`);
  }
  $("report-summary").replaceChildren(...facts.map((f) => el("li", "", f)));

  renderBars(
    $("report-weekdays"),
    r.weekdays.map((row) => ({
      label: WEEKDAY_NAMES[row.wd].slice(0, 3),
      value: row.avg || 0,
      text:
        row.avg === null
          ? "no data"
          : `${row.avg.toFixed(1)} · ${kes(Math.round(row.value))}${tag(row, wk)}`,
      kind: kind(row, wk),
    }))
  );

  renderBars(
    $("report-hours"),
    r.hours.map((row) => ({
      label: hourLabel(row.h),
      value: row.count,
      text: `${row.count}${tag(row, hr)}`,
      kind: kind(row, hr),
    }))
  );
}

// ======================================================================
// Rendering: setup panel
// ======================================================================

function chip(label, onRemove) {
  const li = el("li", "chip");
  li.append(el("span", "", label));
  const x = el("button", "chip-x", "×");
  x.setAttribute("aria-label", "Remove " + label);
  x.addEventListener("click", onRemove);
  li.append(x);
  return li;
}

function renderServiceSetup() {
  $("service-list").replaceChildren(
    ...services.map((s) =>
      chip(`${s.name} – ${kes(s.price)} · ${s.duration} min`, () => removeService(s.name))
    )
  );
}

// [STAFF] One card per person, with a tick box for every service on the menu.
function renderStaffSetup() {
  $("staff-list").replaceChildren(
    ...staff.map((member) => {
      const card = el("li", "staff-card");

      const head = el("div", "staff-head");
      head.append(el("strong", "", member.name));
      const rm = el("button", "danger small", "Remove");
      rm.addEventListener("click", () => removeStaff(member.name));
      head.append(rm);
      card.append(head);

      const checks = el("div", "service-checks");
      for (const s of services) {
        const label = el("label", "check");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = member.services.includes(s.name);
        cb.addEventListener("change", () => setStaffService(member, s.name, cb.checked));
        label.append(cb, document.createTextNode(" " + s.name));
        checks.append(label);
      }
      card.append(checks);
      return card;
    })
  );
}

function renderHours() {
  $("open").value = settings.open;
  $("close").value = settings.close;
}

// ======================================================================
// Rendering: booking form dropdowns
// ======================================================================

function fillSelect(select, values, emptyText) {
  const previous = select.value;
  const options = values.length
    ? values.map((v) => {
        const opt = el("option", "", v);
        opt.value = v;
        return opt;
      })
    : [Object.assign(el("option", "", emptyText), { value: "" })];
  select.replaceChildren(...options);
  if (values.includes(previous)) select.value = previous;
}

// [STAFF] The staff dropdown only shows people who do the chosen service.
function refreshStaffOptions() {
  fillSelect(
    $("staff"),
    staffFor($("service").value).map((s) => s.name),
    "No staff offer this service"
  );
}

// Picking a service fills in its menu price and duration (you can still change them).
function syncFromService() {
  const s = services.find((x) => x.name === $("service").value);
  if (s) {
    $("price").value = s.price;
    $("duration").value = s.duration;
  }
  refreshStaffOptions();
}

function renderFormOptions() {
  fillSelect($("service"), services.map((s) => s.name), "Add a service in setup");
  refreshStaffOptions();
  if (!$("price").value) syncFromService();
}

function render() {
  $("booking-list").replaceChildren(...bookings.map(renderItem));
  $("empty").hidden = bookings.length > 0;
  renderStats();
  renderStaffSummary();
  renderTakings();
  renderReport();
  renderServiceSetup();
  renderStaffSetup();
  renderHours();
  renderFormOptions();
}

// ======================================================================
// Wiring
// ======================================================================

$("service").addEventListener("change", syncFromService);

$("walkin").addEventListener("change", () => {
  const walkIn = $("walkin").checked;
  $("when-label").hidden = walkIn;
  $("when").required = !walkIn;
});

$("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  let result;
  try {
    result = await addBooking({
      customer: $("customer").value,
      phone: $("phone").value,
      service: $("service").value,
      staff: $("staff").value,
      when: $("when").value,
      price: $("price").value,
      duration: $("duration").value,
      walkIn: $("walkin").checked,
    });
  } catch (err) {
    console.error(err);
    return alert("Something went wrong and the booking was not saved. Please try again.");
  }
  if (!result.ok) {
    if (result.message) alert(result.message);
    return; // keep what was typed so the time or staff can be adjusted
  }
  form.reset();
  $("when-label").hidden = false;
  $("when").required = true;
  $("price").value = "";
  $("duration").value = "";
  await refresh();
});

// [STAFF] Add-staff form
$("staff-form").addEventListener("submit", (e) => {
  e.preventDefault();
  addStaff($("new-staff").value.trim());
  e.currentTarget.reset();
});

$("service-form").addEventListener("submit", (e) => {
  e.preventDefault();
  addService(
    $("new-service").value.trim(),
    Number($("new-price").value),
    Number($("new-duration").value)
  );
  e.currentTarget.reset();
});

$("hours-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const open = $("open").value;
  const close = $("close").value;
  if (open >= close) return alert("Closing time must be after opening time.");
  run(() => store.saveSettings({ open, close }));
});

// Payment dialog
$("pay-method").addEventListener("change", () => {
  const mpesa = $("pay-method").value === "mpesa";
  $("pay-code-label").hidden = !mpesa;
  $("pay-code").required = mpesa;
});
$("pay-form").addEventListener("submit", (e) => {
  e.preventDefault();
  savePayment();
});
$("pay-cancel").addEventListener("click", () => $("pay-dialog").close());

// Report period
$("report-range").addEventListener("change", (e) => {
  reportDays = Number(e.target.value);
  renderReport();
});

refresh();

