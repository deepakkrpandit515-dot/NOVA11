const $ = id => document.getElementById(id);
const state = { history: [], tasks: [], money: [], withdrawals: [] };
const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let recognition = null;
let activeChatController = null;
let voiceSession = false;

function setStatus(ok, text) {
  $("statusText").textContent = text;
  $("statusDot").parentElement.classList.toggle("online", ok);
}
function backendBase() {
  return ($("backendUrl").value || "").trim().replace(/\/+$/, "");
}
function api(path) {
  const base = backendBase();
  return (base || location.origin) + path;
}
async function checkBackend() {
  $("backendResult").textContent = "Checking backend...";
  try {
    const response = await fetch(api("/api/health"), { method: "GET" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Health check failed");
    setStatus(true, data.aiConfigured ? "Backend + AI online" : "Backend online • AI key missing");
    $("backendResult").textContent = `Backend online • ${data.version} • AI configured: ${data.aiConfigured}`;
    $("chatHint").textContent = data.aiConfigured ? "AI connection configured." : "Backend online hai, lekin OPENAI_API_KEY hosting Environment mein set nahi hai.";
  } catch (error) {
    setStatus(false, "Backend offline");
    $("backendResult").textContent = "Connection failed: " + error.message + ". Hosted HTTPS frontend use karein aur CORS settings check karein.";
  }
}
function addBubble(role, text) {
  const box = document.createElement("div");
  box.className = "bubble " + role;
  const label = document.createElement("b");
  label.textContent = role === "user" ? "YOU" : "NOVA";
  const p = document.createElement("p");
  p.textContent = text;
  box.append(label, p);
  $("chatLog").appendChild(box);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = $("message").value.trim();
  if (!message) return;
  $("message").value = "";
  addBubble("user", message);
  $("avatarState").textContent = "THINKING";
  try {
    activeChatController = new AbortController();
    const response = await fetch(api("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: state.history }),
      signal: activeChatController.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    const reply = data.reply || "No reply received.";
    addBubble("nova", reply);
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.lang = /[\u0900-\u097F]/.test(reply) ? "hi-IN" : "en-IN";
      utterance.rate = 1;
      speechSynthesis.speak(utterance);
    }
    state.history.push({ role: "user", content: message }, { role: "assistant", content: reply });
    state.history = state.history.slice(-12);
    $("avatarState").textContent = "NOVA READY";
  } catch (error) {
    if (error.name === "AbortError") {
      addBubble("nova", "Request stopped.");
      $("avatarState").textContent = "STOPPED";
    } else {
      addBubble("nova", "Connection error: " + error.message);
      $("avatarState").textContent = "CONNECTION ISSUE";
    }
  } finally {
    activeChatController = null;
  }
});
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === button.dataset.page));
  });
});

function loadTasks() {
  state.tasks = stored("nova9_tasks", []);
  $("taskRows").replaceChildren();
  state.tasks.forEach((task, index) => {
    const row = document.createElement("div"); row.className = "row";
    const text = document.createElement("span"); text.textContent = task;
    const del = document.createElement("button"); del.type = "button"; del.textContent = "Remove";
    del.addEventListener("click", () => { state.tasks.splice(index, 1); save("nova9_tasks", state.tasks); loadTasks(); });
    row.append(text, del); $("taskRows").append(row);
  });
}
$("taskForm").addEventListener("submit", event => {
  event.preventDefault(); const value = $("taskInput").value.trim(); if (!value) return;
  state.tasks.push(value); save("nova9_tasks", state.tasks); $("taskInput").value = ""; loadTasks();
});

function loadMoney() {
  state.money = stored("nova9_money", []);
  const income = state.money.filter(x => x.type === "income").reduce((sum, x) => sum + x.amount, 0);
  const expense = state.money.filter(x => x.type === "expense").reduce((sum, x) => sum + x.amount, 0);
  state.withdrawals = stored("nova9_withdrawals", []);
  const reserved = state.withdrawals.filter(x => x.status === "Requested").reduce((sum, x) => sum + x.amount, 0);
  const format = n => "₹" + n.toLocaleString("en-IN");
  $("incomeTotal").textContent = format(income);
  $("expenseTotal").textContent = format(expense);
  $("balanceTotal").textContent = format(Math.max(0, income - expense - reserved));
  $("moneyRows").replaceChildren();
  state.money.slice().reverse().forEach(item => {
    const row = document.createElement("div"); row.className = "row";
    const label = document.createElement("span"); label.textContent = `${item.note || item.type} • ${item.type}`;
    const amount = document.createElement("b"); amount.textContent = (item.type === "income" ? "+" : "-") + format(item.amount);
    row.append(label, amount); $("moneyRows").append(row);
  });
  const wr = $("withdrawRows"); if (wr) { wr.replaceChildren(); state.withdrawals.slice().reverse().forEach(item => { const row = document.createElement("div"); row.className = "row"; const label = document.createElement("span"); label.textContent = `Withdrawal • ${item.status} • ${new Date(item.date).toLocaleDateString("en-IN")}`; const amount = document.createElement("b"); amount.textContent = "−" + format(item.amount); row.append(label, amount); wr.append(row); }); }
}
$("moneyForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number($("moneyAmount").value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.money.push({ amount, type: $("moneyType").value, note: $("moneyNote").value.trim(), date: new Date().toISOString() });
  save("nova9_money", state.money); $("moneyAmount").value = ""; $("moneyNote").value = ""; loadMoney();
});
const withdrawForm = document.getElementById("withdrawForm");
if (withdrawForm) withdrawForm.addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number($("withdrawAmount").value);
  const income = state.money.filter(x => x.type === "income").reduce((sum, x) => sum + x.amount, 0);
  const expense = state.money.filter(x => x.type === "expense").reduce((sum, x) => sum + x.amount, 0);
  const reserved = state.withdrawals.filter(x => x.status === "Requested").reduce((sum, x) => sum + x.amount, 0);
  const available = income - expense - reserved;
  if (!Number.isFinite(amount) || amount <= 0) { $("withdrawStatus").textContent = "Valid amount enter karein."; return; }
  if (amount > available) { $("withdrawStatus").textContent = `Available balance sirf ₹${Math.max(0, available).toLocaleString("en-IN")} hai.`; return; }
  state.withdrawals.push({ amount, status: "Requested", date: new Date().toISOString() });
  save("nova9_withdrawals", state.withdrawals); $("withdrawAmount").value = "";
  $("withdrawStatus").textContent = "Demo request saved on this device. Real money transfer nahi hua."; loadMoney();
});
const exportMoney = document.getElementById("exportMoney");
if (exportMoney) exportMoney.addEventListener("click", () => {
  const rows = [["Date", "Type", "Amount INR", "Note"], ...stored("nova9_money", []).map(x => [new Date(x.date).toLocaleString("en-IN"), x.type, x.amount, x.note || ""])];
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a"); a.href = url; a.download = "nova-money-records.csv"; a.click(); URL.revokeObjectURL(url);
});

$("saveBusiness").addEventListener("click", () => { localStorage.setItem("nova9_business", $("businessNotes").value); alert("Business notes saved on this device."); });
const ideaButton = document.getElementById("scanIdeas");
if (ideaButton) ideaButton.addEventListener("click", () => {
  const ideas = [
    ["Local business social-media service", "Nearby shops ko monthly content calendar, captions aur poster drafts dena.", "₹0–₹500 demo se start; pehle 3 shop owners se demand validate karein."],
    ["Small-business WhatsApp catalogue setup", "Local sellers ke products ko clear catalogue, descriptions aur FAQ mein arrange karna.", "Free tools se sample banayein; customer approval ke baad hi paid work."],
    ["Short-video editing service", "Creators ya shops ke existing clips ko trim, subtitle aur format karna.", "Phone par sample edit karein; client ke footage ki permission zaroor lein."],
    ["Local lead follow-up templates", "Service businesses ke liye inquiry reply, appointment reminder aur FAQ templates.", "Pehle ek niche choose karke 5 sample templates banayein."]
  ];
  const chosen = ideas[Math.floor(Math.random()*ideas.length)];
  const out = document.getElementById("ideaResult");
  out.textContent = `IDEA: ${chosen[0]}\nProblem/Solution: ${chosen[1]}\nLow-cost test: ${chosen[2]}\n\nValidate customer demand first. Income is not guaranteed.`;
});
$("saveResearch").addEventListener("click", () => { localStorage.setItem("nova9_research", $("researchNotes").value); alert("Research notes saved on this device."); });
$("saveMemory").addEventListener("click", () => { localStorage.setItem("nova9_memory", $("memoryNotes").value); alert("Memory notes saved on this device."); });
$("businessNotes").value = localStorage.getItem("nova9_business") || "";
$("researchNotes").value = localStorage.getItem("nova9_research") || "";
$("memoryNotes").value = localStorage.getItem("nova9_memory") || "";
// Browser-local file vault (IndexedDB). Files stay on this device/browser; no cloud upload.
const vaultDB = new Promise((resolve, reject) => {
  const request = indexedDB.open("NOVA_V7_FILE_VAULT", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id", autoIncrement: true });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function vaultAction(mode, value) {
  const db = await vaultDB;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    let req;
    if (mode === "add") req = store.add(value);
    else if (mode === "all") req = store.getAll();
    else req = store.delete(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function renderVault() {
  const box = $("fileRows"); box.replaceChildren();
  try {
    const files = await vaultAction("all");
    $("fileInfo").textContent = `${files.length} file(s) saved on this device.`;
    files.forEach(file => {
      const row = document.createElement("div"); row.className = "row";
      const label = document.createElement("span"); label.textContent = `${file.name} • ${(file.size/1024).toFixed(1)} KB`;
      const actions = document.createElement("span");
      const download = document.createElement("button"); download.type = "button"; download.textContent = "Download";
      download.addEventListener("click", () => { const url = URL.createObjectURL(file.blob); const a = document.createElement("a"); a.href=url; a.download=file.name; a.click(); URL.revokeObjectURL(url); });
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete";
      remove.addEventListener("click", async () => { await vaultAction("delete", file.id); renderVault(); });
      actions.append(download, remove); row.append(label, actions); box.append(row);
    });
  } catch (e) { $("fileInfo").textContent = "Local file storage unavailable in this browser: " + e.message; }
}
$("filePicker").addEventListener("change", async () => {
  const files = [...$("filePicker").files];
  try {
    for (const file of files) await vaultAction("add", { name:file.name, type:file.type, size:file.size, savedAt:new Date().toISOString(), blob:file });
    $("fileInfo").textContent = `${files.length} file(s) saved locally.`;
    $("filePicker").value = ""; renderVault();
  } catch (e) { $("fileInfo").textContent = "Could not save file: " + e.message; }
});
renderVault();
const webSearchForm = document.getElementById("webSearchForm");
if (webSearchForm) webSearchForm.addEventListener("submit", event => {
  event.preventDefault(); const q = $("webSearchQuery").value.trim();
  if (q) window.open("https://www.google.com/search?q=" + encodeURIComponent(q), "_blank", "noopener,noreferrer");
});

$("saveSettings").addEventListener("click", () => {
  localStorage.setItem("nova9_backend", backendBase());
  $("backendResult").textContent = "Backend URL saved on this device.";
});
$("backendUrl").value = localStorage.getItem("nova9_backend") || "";
$("checkBackend").addEventListener("click", checkBackend);

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { addBubble("nova", "Is browser mein voice recognition available nahi hai. Chrome mein try karein."); return; }
  if (recognition) recognition.stop();
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => { $("avatarState").textContent = "LISTENING"; };
  voiceSession = true;
  recognition.onresult = event => {
    $("message").value = event.results[0][0].transcript;
    $("chatForm").requestSubmit();
  };
  recognition.onerror = event => { $("avatarState").textContent = "VOICE ISSUE"; addBubble("nova", "Voice issue: " + event.error); };
  recognition.onend = () => { if ($("avatarState").textContent === "LISTENING") $("avatarState").textContent = "NOVA READY"; };
  recognition.start();
}
function stopVoice() {
  voiceSession = false;
  if (recognition) { recognition.onresult = null; recognition.onend = null; try { recognition.stop(); } catch {} recognition = null; }
  if (activeChatController) activeChatController.abort();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  $("avatarState").textContent = "STOPPED";
}
$("voiceStart").addEventListener("click", startVoice);
$("voiceStop").addEventListener("click", stopVoice);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
loadTasks();
loadMoney();
checkBackend();


// Social Media drafts: saved locally; no automatic publishing or account access.
function loadSocialDrafts() {
  const drafts = stored("nova9_social_drafts", []);
  const host = $("socialRows");
  host.replaceChildren();
  drafts.forEach((draft, index) => {
    const row = document.createElement("div"); row.className = "row social-row";
    const text = document.createElement("span");
    text.textContent = `${draft.platform}: ${draft.text.slice(0, 90)}${draft.text.length > 90 ? "…" : ""}`;
    const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Copy";
    copy.addEventListener("click", async () => { await navigator.clipboard?.writeText([draft.text, draft.tags].filter(Boolean).join("\n\n")); copy.textContent = "Copied"; });
    const del = document.createElement("button"); del.type = "button"; del.textContent = "Remove";
    del.addEventListener("click", () => { const next = stored("nova9_social_drafts", []); next.splice(index, 1); save("nova9_social_drafts", next); loadSocialDrafts(); });
    row.append(text, copy, del); host.append(row);
  });
}
$("saveSocialDraft").addEventListener("click", () => {
  const text = $("socialDraft").value.trim();
  if (!text) { alert("Pehle post/caption likhein."); return; }
  const drafts = stored("nova9_social_drafts", []);
  drafts.unshift({ platform: $("socialPlatform").value, text, tags: $("socialTags").value.trim(), createdAt: new Date().toISOString() });
  save("nova9_social_drafts", drafts.slice(0, 50)); $("socialDraft").value = ""; $("socialTags").value = ""; loadSocialDrafts();
});
$("saveSocialReply").addEventListener("click", () => {
  const text = $("socialReply").value.trim();
  if (!text) { alert("Pehle reply draft likhein."); return; }
  const drafts = stored("nova9_social_drafts", []);
  drafts.unshift({ platform: "Reply draft", text, tags: "", createdAt: new Date().toISOString() });
  save("nova9_social_drafts", drafts.slice(0, 50)); $("socialReply").value = ""; loadSocialDrafts();
});
loadSocialDrafts();

// PWA install prompt (supported browsers only).
let installPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); installPrompt = event;
  const button = $("installApp"); if (button) button.hidden = false;
});
const installButton = $("installApp");
if (installButton) installButton.addEventListener("click", async () => {
  if (!installPrompt) { alert("Chrome menu > Add to Home screen se install karein."); return; }
  installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; installButton.hidden = true;
});

// Local photo editor: canvas preview with brightness, contrast and saturation.
let photoImage = null;
let photoObjectUrl = null;
function renderPhoto() {
  if (!photoImage) return;
  const canvas = $("photoCanvas");
  const ctx = canvas.getContext("2d");
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(photoImage.naturalWidth, photoImage.naturalHeight));
  canvas.width = Math.max(1, Math.round(photoImage.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photoImage.naturalHeight * scale));
  ctx.filter = `brightness(${$("photoBrightness").value}%) contrast(${$("photoContrast").value}%) saturate(${$("photoSaturation").value}%)`;
  ctx.drawImage(photoImage, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
}
$("photoPicker").addEventListener("change", () => {
  const file = $("photoPicker").files[0];
  if (!file) return;
  if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
  photoObjectUrl = URL.createObjectURL(file);
  photoImage = new Image();
  photoImage.onload = renderPhoto;
  photoImage.src = photoObjectUrl;
});
["photoBrightness", "photoContrast", "photoSaturation"].forEach(id => $(id).addEventListener("input", renderPhoto));
$("resetPhoto").addEventListener("click", () => {
  $("photoBrightness").value = "100";
  $("photoContrast").value = "100";
  $("photoSaturation").value = "100";
  renderPhoto();
});
$("downloadPhoto").addEventListener("click", () => {
  if (!photoImage) { alert("Pehle photo choose karein."); return; }
  const link = document.createElement("a");
  link.download = "nova9-edited-photo.png";
  link.href = $("photoCanvas").toDataURL("image/png");
  link.click();
});

// Video preview and download of the original selected file.
let videoObjectUrl = null;
$("videoPicker").addEventListener("change", () => {
  const file = $("videoPicker").files[0];
  if (!file) return;
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = URL.createObjectURL(file);
  $("videoPreview").src = videoObjectUrl;
});
$("downloadVideo").addEventListener("click", () => {
  if (!videoObjectUrl) { alert("Pehle video choose karein."); return; }
  const file = $("videoPicker").files[0];
  const link = document.createElement("a");
  link.href = videoObjectUrl;
  link.download = file?.name || "nova9-video";
  link.click();
});

loadSocialDrafts();



// Local backup/restore: exports only NOVA data stored in this browser.
const NOVA_DATA_KEYS = [
  "nova9_tasks", "nova9_money", "nova9_withdrawals", "nova9_business",
  "nova9_research", "nova9_memory", "nova9_social_drafts", "nova9_backend"
];
const exportBackupButton = $("exportBackup");
const importBackupInput = $("importBackup");
const backupStatus = $("backupStatus");
if (exportBackupButton) exportBackupButton.addEventListener("click", () => {
  const payload = { app: "NOVA V7", formatVersion: 1, exportedAt: new Date().toISOString(), data: {} };
  NOVA_DATA_KEYS.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) payload.data[key] = value;
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `nova-v7-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click(); URL.revokeObjectURL(url);
  if (backupStatus) backupStatus.textContent = "Backup file downloaded. Ise private jagah par rakhein.";
});
if (importBackupInput) importBackupInput.addEventListener("change", async () => {
  const file = importBackupInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("Backup file 2 MB se chhoti honi chahiye.");
    const payload = JSON.parse(await file.text());
    if (payload.app !== "NOVA V7" || payload.formatVersion !== 1 || !payload.data || typeof payload.data !== "object") {
      throw new Error("Yeh valid NOVA V7 backup nahi hai.");
    }
    if (!confirm("Current local NOVA data selected backup se replace hoga. Continue?")) return;
    NOVA_DATA_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(payload.data, key)) {
        const raw = payload.data[key];
        if (typeof raw !== "string") throw new Error("Backup format invalid hai.");
        // Validate JSON-backed records before writing them.
        if (key !== "nova9_business" && key !== "nova9_research" && key !== "nova9_memory" && key !== "nova9_backend") JSON.parse(raw);
        localStorage.setItem(key, raw);
      }
    });
    if (backupStatus) backupStatus.textContent = "Backup restore ho gaya. Page reload ho raha hai.";
    location.reload();
  } catch (error) {
    if (backupStatus) backupStatus.textContent = "Restore failed: " + error.message;
  } finally {
    importBackupInput.value = "";
  }
});
const clearDataButton = $("clearLocalData");
if (clearDataButton) clearDataButton.addEventListener("click", () => {
  if (!confirm("NOVA ke saved tasks, notes, money records aur drafts is browser se permanently clear honge. Pehle backup le liya hai?")) return;
  NOVA_DATA_KEYS.forEach(key => localStorage.removeItem(key));
  location.reload();
});
