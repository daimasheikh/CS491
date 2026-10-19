/* Personal Productivity Dashboard
   - Daily motivation quote (live API + offline fallback)
   - Current weather (Open-Meteo, no API key) via geolocation or city search
   - Task tracker with colorful progress bar, persisted in localStorage
*/

/* ----------------------------- Clock & greeting ----------------------------- */
function updateClock() {
  const now = new Date();
  const clock = document.getElementById("clock");
  clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const hour = now.getHours();
  const greet =
    hour < 5 ? "Burning the midnight oil 🌙" :
    hour < 12 ? "Good morning ☀️" :
    hour < 17 ? "Good afternoon 👋" :
    hour < 21 ? "Good evening 🌆" : "Winding down 🌙";
  document.getElementById("greeting").textContent = greet;

  document.getElementById("today").textContent = now.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}

/* ----------------------------- Motivation quote ----------------------------- */
const FALLBACK_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" }
];

function showQuote(text, author) {
  const card = document.querySelector(".quote-card");
  card.classList.add("fade");
  setTimeout(() => {
    document.getElementById("quoteText").textContent = `“${text}”`;
    document.getElementById("quoteAuthor").textContent = author ? `— ${author}` : "";
    card.classList.remove("fade");
  }, 200);
}

function randomFallbackQuote() {
  const q = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
  showQuote(q.text, q.author);
}

async function loadQuote() {
  try {
    const res = await fetch("https://api.quotable.io/random?tags=inspirational|motivational|wisdom", { cache: "no-store" });
    if (!res.ok) throw new Error("quote request failed");
    const data = await res.json();
    if (data && data.content) {
      showQuote(data.content, data.author);
      return;
    }
    throw new Error("unexpected quote payload");
  } catch (err) {
    // Network blocked or API down: use a local quote so the card is never empty.
    randomFallbackQuote();
  }
}

/* ----------------------------- Weather ----------------------------- */
// Open-Meteo WMO weather codes -> { emoji, description }
const WEATHER_CODES = {
  0:  ["☀️", "Clear sky"],
  1:  ["🌤️", "Mainly clear"],
  2:  ["⛅", "Partly cloudy"],
  3:  ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌧️", "Dense drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Freezing drizzle"],
  61: ["🌦️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["🌨️", "Snow grains"],
  80: ["🌦️", "Rain showers"],
  81: ["🌧️", "Rain showers"],
  82: ["⛈️", "Violent rain showers"],
  85: ["🌨️", "Snow showers"],
  86: ["❄️", "Heavy snow showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm w/ hail"],
  99: ["⛈️", "Thunderstorm w/ hail"]
};

const WEATHER_KEY = "dashboard.lastWeatherLocation";

function setWeatherStatus(msg) {
  document.getElementById("weatherDesc").textContent = msg;
}

async function fetchWeather(lat, lon, label) {
  try {
    setWeatherStatus("Fetching weather…");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&temperature_unit=celsius&wind_speed_unit=kmh`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("weather request failed");
    const data = await res.json();
    const c = data.current;
    const [emoji, desc] = WEATHER_CODES[c.weather_code] || ["🌡️", "Unknown"];

    document.getElementById("weatherIcon").textContent = emoji;
    document.getElementById("weatherTemp").textContent = `${Math.round(c.temperature_2m)}°C`;
    document.getElementById("weatherDesc").textContent = desc;
    document.getElementById("weatherPlace").textContent = label || "";
    document.getElementById("weatherMeta").innerHTML =
      `<span>🌡️ Feels like ${Math.round(c.apparent_temperature)}°C</span>` +
      `<span>💧 ${c.relative_humidity_2m}%</span>` +
      `<span>💨 ${Math.round(c.wind_speed_10m)} km/h</span>`;

    localStorage.setItem(WEATHER_KEY, JSON.stringify({ lat, lon, label }));
  } catch (err) {
    setWeatherStatus("Couldn't load weather. Try a city search.");
    document.getElementById("weatherMeta").innerHTML = "";
  }
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  if (!data.results || !data.results.length) return null;
  const r = data.results[0];
  const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
  return { lat: r.latitude, lon: r.longitude, label };
}

async function searchCity(name) {
  if (!name.trim()) return;
  setWeatherStatus(`Searching “${name}”…`);
  try {
    const loc = await geocodeCity(name.trim());
    if (!loc) { setWeatherStatus(`No match for “${name}”.`); return; }
    await fetchWeather(loc.lat, loc.lon, loc.label);
  } catch (err) {
    setWeatherStatus("City search failed. Check your connection.");
  }
}

function initWeather() {
  // Prefer a saved location, then try geolocation, else a sensible default.
  const saved = localStorage.getItem(WEATHER_KEY);
  if (saved) {
    try {
      const { lat, lon, label } = JSON.parse(saved);
      fetchWeather(lat, lon, label);
      return;
    } catch (_) { /* fall through */ }
  }

  if ("geolocation" in navigator) {
    setWeatherStatus("Locating you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your location"),
      () => {
        setWeatherStatus("Location off — showing London.");
        fetchWeather(51.5074, -0.1278, "London, England, GB");
      },
      { timeout: 8000 }
    );
  } else {
    fetchWeather(51.5074, -0.1278, "London, England, GB");
  }
}

/* ----------------------------- Task tracker ----------------------------- */
const TASKS_KEY = "dashboard.tasks";
let tasks = [];

function loadTasks() {
  try {
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
  } catch (_) {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function renderTasks() {
  const list = document.getElementById("taskList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";

  empty.style.display = tasks.length ? "none" : "block";

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = task.done;
    check.setAttribute("aria-label", "Mark complete");
    check.addEventListener("change", () => toggleTask(task.id));

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const del = document.createElement("button");
    del.className = "task-delete";
    del.textContent = "✕";
    del.title = "Delete task";
    del.setAttribute("aria-label", "Delete task");
    del.addEventListener("click", () => deleteTask(task.id));

    li.append(check, text, del);
    list.appendChild(li);
  });

  updateProgress();
}

function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressLabel").textContent = pct + "% complete";
  document.getElementById("taskCount").textContent = `${done} / ${total}`;
}

function addTask(text) {
  tasks.push({ id: Date.now() + Math.random().toString(16).slice(2), text, done: false });
  saveTasks();
  renderTasks();
}

function toggleTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (t) { t.done = !t.done; saveTasks(); renderTasks(); }
}

function deleteTask(id) {
  tasks = tasks.filter((x) => x.id !== id);
  saveTasks();
  renderTasks();
}

/* ----------------------------- Desktop notifications ----------------------------- */
function ensureNotifyPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notify(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "" });
      return;
    }
  } catch (_) { /* fall through to in-page cue */ }
  // Fallback: brief title-bar flash so users without notification permission still get a cue.
  const original = document.title;
  document.title = "⏰ " + title;
  setTimeout(() => { document.title = original; }, 4000);
}

/* ----------------------------- Cat facts ----------------------------- */
const FALLBACK_CAT_FACTS = [
  "Cats sleep for about 70% of their lives.",
  "A group of cats is called a clowder.",
  "Cats have five toes on their front paws but only four on the back.",
  "A cat can rotate its ears 180 degrees.",
  "Cats can make over 100 different vocal sounds.",
  "A cat's nose print is unique, much like a human fingerprint.",
  "Cats can run up to about 30 miles per hour over short distances.",
  "The oldest known pet cat existed roughly 9,500 years ago."
];

async function showCatFact() {
  const box = document.getElementById("catFact");
  const textEl = document.getElementById("catFactText");
  box.hidden = false;
  textEl.textContent = "Fetching a fun cat fact…";
  try {
    const res = await fetch("https://catfact.ninja/fact", { cache: "no-store" });
    if (!res.ok) throw new Error("cat fact request failed");
    const data = await res.json();
    textEl.textContent = data && data.fact ? data.fact : pickFallbackCatFact();
  } catch (_) {
    textEl.textContent = pickFallbackCatFact();
  }
}

function pickFallbackCatFact() {
  return FALLBACK_CAT_FACTS[Math.floor(Math.random() * FALLBACK_CAT_FACTS.length)];
}

function hideCatFact() {
  document.getElementById("catFact").hidden = true;
}

/* ----------------------------- Pomodoro timer ----------------------------- */
const POMO_STATS_KEY = "dashboard.pomoStats";

const pomo = {
  mode: "focus",        // focus | short | long
  durations: { focus: 25 * 60, short: 5 * 60, long: 15 * 60 },
  remaining: 25 * 60,
  total: 25 * 60,
  intervalId: null,
  running: false
};

function pomoFormat(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pomoRender() {
  document.getElementById("pomoTime").textContent = pomoFormat(pomo.remaining);
  const pct = pomo.total ? ((pomo.total - pomo.remaining) / pomo.total) * 100 : 0;
  document.getElementById("pomoProgress").style.width = pct + "%";

  const isBreak = pomo.mode !== "focus";
  document.querySelector(".pomodoro-card").classList.toggle("is-break", isBreak);
  document.getElementById("pomoPhase").textContent =
    pomo.mode === "focus" ? "Focus" : pomo.mode === "short" ? "Short Break" : "Long Break";
  document.getElementById("pomoStartBtn").textContent = pomo.running ? "Pause" : "Start";
}

function pomoSetMode(mode, minutes, { autostart = false } = {}) {
  pomo.mode = mode;
  pomo.total = (minutes != null ? minutes * 60 : pomo.durations[mode]);
  pomo.remaining = pomo.total;
  pomoStop();

  document.querySelectorAll(".pomo-mode").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.mode === mode);
  });

  if (mode === "focus") hideCatFact();
  pomoRender();
  if (autostart) pomoStart();
}

function pomoTick() {
  if (pomo.remaining > 0) {
    pomo.remaining -= 1;
    pomoRender();
    if (pomo.remaining === 0) pomoComplete();
  }
}

function pomoStart() {
  if (pomo.running || pomo.remaining === 0) return;
  ensureNotifyPermission();
  pomo.running = true;
  pomo.intervalId = setInterval(pomoTick, 1000);
  pomoRender();
}

function pomoStop() {
  pomo.running = false;
  if (pomo.intervalId) { clearInterval(pomo.intervalId); pomo.intervalId = null; }
  pomoRender();
}

function pomoToggle() {
  if (pomo.running) pomoStop();
  else pomoStart();
}

function pomoReset() {
  pomo.remaining = pomo.total;
  pomoStop();
}

function pomoBumpStats() {
  let stats;
  try { stats = JSON.parse(localStorage.getItem(POMO_STATS_KEY)); } catch (_) { stats = null; }
  const today = new Date().toDateString();
  if (!stats || stats.date !== today) stats = { date: today, count: 0 };
  stats.count += 1;
  localStorage.setItem(POMO_STATS_KEY, JSON.stringify(stats));
  pomoRenderStats();
}

function pomoRenderStats() {
  let stats;
  try { stats = JSON.parse(localStorage.getItem(POMO_STATS_KEY)); } catch (_) { stats = null; }
  const today = new Date().toDateString();
  const count = stats && stats.date === today ? stats.count : 0;
  document.getElementById("pomoStats").textContent =
    `${count} focus session${count === 1 ? "" : "s"} done today`;
}

function pomoComplete() {
  pomoStop();
  const finished = pomo.mode;

  if (finished === "focus") {
    pomoBumpStats();
    // Every 4th focus session earns a long break, otherwise a short one.
    let stats;
    try { stats = JSON.parse(localStorage.getItem(POMO_STATS_KEY)); } catch (_) { stats = null; }
    const count = stats ? stats.count : 1;
    const nextIsLong = count % 4 === 0;
    notify("Focus session complete! 🎉", "Time for a break. Enjoy a cat fact while you rest.");
    showCatFact();
    pomoSetMode(nextIsLong ? "long" : "short",
      nextIsLong ? pomo.durations.long / 60 : pomo.durations.short / 60,
      { autostart: true });
  } else {
    notify("Break's over ⏰", "Back to it. Starting your next focus session.");
    hideCatFact();
    pomoSetMode("focus", pomo.durations.focus / 60, { autostart: true });
  }
}

function pomoSkip() {
  // Jump straight to completing the current phase's transition.
  pomo.remaining = 0;
  pomoComplete();
}

function initPomodoro() {
  pomoRenderStats();
  pomoRender();

  document.getElementById("pomoStartBtn").addEventListener("click", pomoToggle);
  document.getElementById("pomoResetBtn").addEventListener("click", pomoReset);
  document.getElementById("pomoSkipBtn").addEventListener("click", pomoSkip);

  document.querySelectorAll(".pomo-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      pomoSetMode(btn.dataset.mode, Number(btn.dataset.min));
    });
  });
}

/* ----------------------------- Wire up ----------------------------- */
function init() {
  updateClock();
  setInterval(updateClock, 1000 * 10);

  loadQuote();
  document.getElementById("newQuoteBtn").addEventListener("click", loadQuote);

  initWeather();
  document.getElementById("refreshWeatherBtn").addEventListener("click", initWeather);
  document.getElementById("citySearchBtn").addEventListener("click", () => {
    searchCity(document.getElementById("cityInput").value);
  });
  document.getElementById("cityInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchCity(e.target.value);
  });

  initPomodoro();

  loadTasks();
  renderTasks();
  document.getElementById("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("taskInput");
    const value = input.value.trim();
    if (value) { addTask(value); input.value = ""; input.focus(); }
  });
}

document.addEventListener("DOMContentLoaded", init);
