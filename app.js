const $ = id => document.getElementById(id);
const state = { history: [], tasks: [], money: [] };
const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let recognition = null;

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
    const response = await fetch(api("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: state.history })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    const reply = data.reply || "No reply received.";
    addBubble("nova", reply);
    state.history.push({ role: "user", content: message }, { role: "assistant", content: reply });
    state.history = state.history.slice(-12);
    $("avatarState").textContent = "NOVA READY";
  } catch (error) {
    addBubble("nova", "Connection error: " + error.message);
    $("avatarState").textContent = "CONNECTION ISSUE";
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
  const format = n => "₹" + n.toLocaleString("en-IN");
  $("incomeTotal").textContent = format(income);
  $("expenseTotal").textContent = format(expense);
  $("balanceTotal").textContent = format(income - expense);
  $("moneyRows").replaceChildren();
  state.money.slice().reverse().forEach(item => {
    const row = document.createElement("div"); row.className = "row";
    const label = document.createElement("span"); label.textContent = `${item.note || item.type} • ${item.type}`;
    const amount = document.createElement("b"); amount.textContent = (item.type === "income" ? "+" : "-") + format(item.amount);
    row.append(label, amount); $("moneyRows").append(row);
  });
}
$("moneyForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number($("moneyAmount").value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.money.push({ amount, type: $("moneyType").value, note: $("moneyNote").value.trim(), date: new Date().toISOString() });
  save("nova9_money", state.money); $("moneyAmount").value = ""; $("moneyNote").value = ""; loadMoney();
});

$("saveBusiness").addEventListener("click", () => { localStorage.setItem("nova9_business", $("businessNotes").value); alert("Business notes saved on this device."); });
$("saveResearch").addEventListener("click", () => { localStorage.setItem("nova9_research", $("researchNotes").value); alert("Research notes saved on this device."); });
$("saveMemory").addEventListener("click", () => { localStorage.setItem("nova9_memory", $("memoryNotes").value); alert("Memory notes saved on this device."); });
$("businessNotes").value = localStorage.getItem("nova9_business") || "";
$("researchNotes").value = localStorage.getItem("nova9_research") || "";
$("memoryNotes").value = localStorage.getItem("nova9_memory") || "";
$("filePicker").addEventListener("change", () => {
  const file = $("filePicker").files[0];
  $("fileInfo").textContent = file ? `${file.name} • ${(file.size / 1024).toFixed(1)} KB • selected locally, not uploaded` : "No file selected.";
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
  recognition.onresult = event => {
    $("message").value = event.results[0][0].transcript;
    $("chatForm").requestSubmit();
  };
  recognition.onerror = event => { $("avatarState").textContent = "VOICE ISSUE"; addBubble("nova", "Voice issue: " + event.error); };
  recognition.onend = () => { if ($("avatarState").textContent === "LISTENING") $("avatarState").textContent = "NOVA READY"; };
  recognition.start();
}
function stopVoice() {
  if (recognition) { recognition.onresult = null; recognition.stop(); recognition = null; }
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
    const row = document.createElement("div");
    row.className = "row social-row";
    const text = document.createElement("span");
    text.textContent = `${draft.platform}: ${draft.text.slice(0, 90)}${draft.text.length > 90 ? "…" : ""}`;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      const next = stored("nova9_social_drafts", []);
      next.splice(index, 1);
      save("nova9_social_drafts", next);
      loadSocialDrafts();
    });
    row.append(text, del);
    host.append(row);
  });
}
$("saveSocialDraft").addEventListener("click", () => {
  const text = $("socialDraft").value.trim();
  if (!text) { alert("Pehle post/caption likhein."); return; }
  const drafts = stored("nova9_social_drafts", []);
  drafts.unshift({
    platform: $("socialPlatform").value,
    text,
    tags: $("socialTags").value.trim(),
    createdAt: new Date().toISOString()
  });
  save("nova9_social_drafts", drafts.slice(0, 50));
  $("socialDraft").value = "";
  $("socialTags").value = "";
  loadSocialDrafts();
});
$("saveSocialReply").addEventListener("click", () => {
  const text = $("socialReply").value.trim();
  if (!text) { alert("Pehle reply draft likhein."); return; }
  const drafts = stored("nova9_social_drafts", []);
  drafts.unshift({ platform: "Reply draft", text, tags: "", createdAt: new Date().toISOString() });
  save("nova9_social_drafts", drafts.slice(0, 50));
  $("socialReply").value = "";
  loadSocialDrafts();
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
