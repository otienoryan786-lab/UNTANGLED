// store.js – the ONLY file that knows where UNTANGLED keeps its data.
//
// Right now it uses the browser's localStorage. Every method is `async`
// on purpose: when we pick a backend (Supabase, Firebase, Neon + an API...),
// we rewrite the inside of these methods to talk to it, and app.js does not change.

const store = (() => {
  const KEYS = {
    bookings: "untangled.bookings",
    staff: "untangled.staff",
    services: "untangled.services",
    settings: "untangled.settings",
  };

  const DEFAULT_SERVICES = [
    { name: "Haircut", price: 300, duration: 30 },
    { name: "Shave", price: 150, duration: 15 },
    { name: "Haircut + shave", price: 400, duration: 45 },
  ];
  const DEFAULT_SETTINGS = { open: "08:00", close: "19:00", loyaltyEvery: 5 }; // loyaltyEvery: every Nth visit is free (0 = off)

  // ---- low-level read/write -------------------------------------------
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  // ---- readers that also upgrade older saved data ----------------------
  const getServices = () =>
    read(KEYS.services, DEFAULT_SERVICES).map((s) => ({ duration: 30, ...s }));

  const getStaff = () => {
    const all = getServices().map((s) => s.name);
    return read(KEYS.staff, [{ name: "Me", services: all }]).map((m) =>
      typeof m === "string" ? { name: m, services: all } : m
    );
  };

  const getBookings = () => {
    const firstStaff = getStaff()[0].name;
    return read(KEYS.bookings, []).map((b) => ({
      staff: firstStaff,
      status: "booked",
      duration: 30,
      payMethod: null, // "cash" | "mpesa" | "loyalty" | null
      mpesaCode: "",
      reward: false, // true when this visit was a free loyalty visit
      ...b,
    }));
  };

  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });

  const byStart = (a, b) => new Date(a.when) - new Date(b.when);

  // ---- public API ---------------------------------------------------------
  return {
    async loadAll() {
      return {
        bookings: getBookings(),
        staff: getStaff(),
        services: getServices(),
        settings: getSettings(),
      };
    },

    // Bookings
    async addBooking(booking) {
      const list = getBookings();
      list.push(booking);
      list.sort(byStart);
      write(KEYS.bookings, list);
    },
    async updateBooking(id, changes) {
      const list = getBookings().map((b) => (b.id === id ? { ...b, ...changes } : b));
      write(KEYS.bookings, list);
    },
    async removeBooking(id) {
      write(KEYS.bookings, getBookings().filter((b) => b.id !== id));
    },

    // [STAFF] Staff and what each person does
    async addStaff(name) {
      const list = getStaff();
      if (list.some((m) => m.name === name)) return;
      // New staff start out doing every service; untick the ones they don't do.
      list.push({ name, services: getServices().map((s) => s.name) });
      write(KEYS.staff, list);
    },
    async removeStaff(name) {
      const list = getStaff();
      if (list.length === 1) throw new Error("Keep at least one staff member.");
      // Old bookings keep the name as text, so history isn't lost.
      write(KEYS.staff, list.filter((m) => m.name !== name));
    },
    async setStaffService(staffName, serviceName, does) {
      const list = getStaff();
      const member = list.find((m) => m.name === staffName);
      if (!member) return;
      const set = new Set(member.services);
      does ? set.add(serviceName) : set.delete(serviceName);
      member.services = [...set];
      write(KEYS.staff, list);
    },

    // Services
    async addService(service) {
      const list = getServices();
      if (list.some((s) => s.name === service.name)) return;
      list.push(service);
      write(KEYS.services, list);
      // New services are offered by every staff member until you untick them.
      write(KEYS.staff, getStaff().map((m) => ({ ...m, services: [...m.services, service.name] })));
    },
    async removeService(name) {
      write(KEYS.services, getServices().filter((s) => s.name !== name));
      write(
        KEYS.staff,
        getStaff().map((m) => ({ ...m, services: m.services.filter((n) => n !== name) }))
      );
    },

    // Opening hours
    async saveSettings(settings) {
      write(KEYS.settings, { ...getSettings(), ...settings });
    },
  };
})();
