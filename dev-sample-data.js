// dev-sample-data.js – FOR TESTING ONLY. index.html does NOT load this file.
//
// How to use:
//  1. Open index.html in your browser.
//  2. Press F12 and open the Console tab.
//  3. Copy the "ADD" block below, paste it into the console, press Enter.
//  4. Scroll to "Busy and quiet days" to see the report.
//  5. When you're done, paste the "REMOVE" block to delete the fake bookings.
//     (Only bookings whose id starts with "sample-" are removed. Your real ones stay.)

// ---------------------------- ADD ----------------------------
(async () => {
  const pad = (n) => String(n).padStart(2, "0");
  const names = ["Wanjiru", "Brian", "Aisha", "Kevin", "Mercy", "Otieno", "Faith", "Samuel"];
  const perDay = [3, 2, 2, 3, 4, 7, 8]; // Sunday..Saturday: weekends busy, midweek quiet
  const hoursPool = [9, 10, 11, 12, 14, 15, 16, 17];
  let n = 0;

  for (let ago = 45; ago >= 1; ago--) {
    const day = new Date();
    day.setDate(day.getDate() - ago);
    const hours = [...hoursPool].sort(() => Math.random() - 0.5).slice(0, perDay[day.getDay()]);

    for (const h of hours) {
      const when = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(h)}:00`;
      const service = services[n % services.length];
      const noShow = Math.random() < 0.12;
      await store.addBooking({
        id: "sample-" + n,
        customer: names[n % names.length],
        phone: "0712345678",
        service: service.name,
        staff: staff[0].name,
        when,
        duration: service.duration,
        price: service.price,
        status: noShow ? "no-show" : "done",
        walkIn: false,
        paid: !noShow,
        payMethod: noShow ? null : "cash",
        mpesaCode: "",
      });
      n++;
    }
  }
  await refresh();
})();

// ---------------------------- REMOVE ----------------------------
// (async () => {
//   for (const b of bookings.filter((b) => b.id.startsWith("sample-"))) {
//     await store.removeBooking(b.id);
//   }
//   await refresh();
// })();
