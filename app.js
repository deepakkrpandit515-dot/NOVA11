const $ = id => document.getElementById(id);
const store = {
  get(k, fallback) { try { return JSON.parse(localStorage.getItem("nova_"+k)) ?? fallback; } catch { return fallback; } },
  set(k, v) { localStorage.setItem("nova_"+k, JSON.stringify(v)); }
};
let backend = localStorage.getItem("nova_backend") || "";
let history = store.get("history", []);
let recognition = null;
let speaking = false;
const money = store.get("money", []), tasks = store.get("tasks", []), social = store.get("social", []);

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === id));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === id));
  if (id === "chat") $("message").focus({preventScroll:true});
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = "bubble " + role;
  div.innerHTML = `<b>${role === "user" ? "YOU" : "NOVA"}</b><p>${escapeHtml(text)}</p>`;
  $("chatLog").appendChild(div); $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text);
  u.lang = "hi-IN"; u.rate = 1; speechSynthesis.speak(u);
}
async function sendMessage(message) {
  message = message.trim(); if (!message) return;
  addBubble("user", message); history.push({role:"user",content:message}); store.set("history",history);
  $("chatHint").textContent = "NOVA soch rahi hai...";
  try {
    const response = await fetch((backend || "") + "/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message,history:history.slice(-12,-1)})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Backend request failed");
    const reply = data.reply || "Mujhe jawab nahi mila.";
    addBubble("nova",reply); history.push({role:"assistant",content:reply}); history=history.slice(-30); store.set("history",history);
    $("chatHint").textContent = "Connected • Reply ready";
    if (speaking) speak(reply);
  } catch (e) {
    const msg = `Connection issue: ${e.message}. Settings mein backend URL aur provider setup check karein.`;
    addBubble("nova",msg); $("chatHint").textContent = msg;
  }
}
$("chatForm").addEventListener("submit", e => {e.preventDefault(); const m=$("message").value; $("message").value=""; sendMessage(m);});

async function checkBackend() {
  const url = $("backendUrl").value.trim().replace(/\/+$/,"");
  $("backendResult").textContent = "Checking...";
  try {
    const r = await fetch(url + "/api/health"); const d = await r.json();
    if (!r.ok || !d.ok) throw new Error("Health check failed");
    backend=url; localStorage.setItem("nova_backend",backend);
    $("statusText").textContent="Backend online"; $("statusDot").parentElement.classList.add("online");
    $("backendResult").textContent=`Connected: ${d.app || "NOVA"} • Backend online`;
    $("providerStatus").textContent=`Gemini key: ${d.providers?.gemini ? "configured" : "missing"} • Groq key: ${d.providers?.groq ? "configured" : "missing"}`;
  } catch(e) { $("statusText").textContent="Backend offline"; $("statusDot").parentElement.classList.remove("online"); $("backendResult").textContent=e.message; }
}
$("backendUrl").value=backend;
$("checkBackend").addEventListener("click",checkBackend);
$("saveSettings").addEventListener("click",()=>{backend=$("backendUrl").value.trim().replace(/\/+$/,"");localStorage.setItem("nova_backend",backend);$("backendResult").textContent="Backend URL saved.";});
if (backend) checkBackend(); else { $("statusText").textContent="Local mode"; $("backendResult").textContent="Same-host deployment mein backend URL blank rakhein."; }

$("scanIdeas").addEventListener("click",()=>{const idea=$("businessNotes").value.trim() || "zero-budget beginner business ideas";showPage("chat");sendMessage("Mujhe is topic par practical business planning do. Customer problem, low-cost test, risks aur first 3 steps batao. Guaranteed income claim mat karna: "+idea);});
$("saveBusiness").addEventListener("click",()=>{store.set("businessNotes",$("businessNotes").value);$("ideaResult").textContent="Notes saved on this device.";});
$("businessNotes").value=store.get("businessNotes","");
$("saveSocial").addEventListener("click",()=>{social.unshift({platform:$("socialPlatform").value,text:$("socialDraft").value,tags:$("socialTags").value});store.set("social",social);renderSocial();$("socialDraft").value="";$("socialTags").value="";});
function renderSocial(){$("socialRows").innerHTML=social.map((x,i)=>`<div class="rowitem"><span><b>${escapeHtml(x.platform)}</b><br>${escapeHtml(x.text)} ${escapeHtml(x.tags)}</span><button class="btn danger" data-del-social="${i}">Delete</button></div>`).join("");}
$("socialRows").addEventListener("click",e=>{const i=e.target.dataset.delSocial;if(i!==undefined){social.splice(+i,1);store.set("social",social);renderSocial();}});renderSocial();

function renderMoney(){const income=money.filter(x=>x.type==="income").reduce((a,x)=>a+x.amount,0),expense=money.filter(x=>x.type==="expense").reduce((a,x)=>a+x.amount,0);$("incomeTotal").textContent="₹"+income.toLocaleString("en-IN");$("expenseTotal").textContent="₹"+expense.toLocaleString("en-IN");$("balanceTotal").textContent="₹"+(income-expense).toLocaleString("en-IN");$("moneyRows").innerHTML=money.map(x=>`<div class="rowitem"><span>${escapeHtml(x.note||x.type)} • ${x.type}</span><b>₹${x.amount.toLocaleString("en-IN")}</b></div>`).join("");}
$("moneyForm").addEventListener("submit",e=>{e.preventDefault();money.unshift({amount:Number($("moneyAmount").value),type:$("moneyType").value,note:$("moneyNote").value});store.set("money",money);e.target.reset();renderMoney();});renderMoney();
$("exportMoney").addEventListener("click",()=>download("nova-money.csv","type,amount,note\n"+money.map(x=>`${x.type},${x.amount},"${String(x.note).replace(/"/g,'""')}"`).join("\n"),"text/csv"));
function renderTasks(){$("taskRows").innerHTML=tasks.map((t,i)=>`<div class="rowitem"><label><input type="checkbox" data-task="${i}" ${t.done?"checked":""}> ${escapeHtml(t.text)}</label><button class="btn danger" data-task-del="${i}">Delete</button></div>`).join("");}
$("taskForm").addEventListener("submit",e=>{e.preventDefault();tasks.unshift({text:$("taskInput").value,done:false});store.set("tasks",tasks);$("taskInput").value="";renderTasks();});
$("taskRows").addEventListener("change",e=>{if(e.target.dataset.task!==undefined){tasks[+e.target.dataset.task].done=e.target.checked;store.set("tasks",tasks);renderTasks();}});
$("taskRows").addEventListener("click",e=>{if(e.target.dataset.taskDel!==undefined){tasks.splice(+e.target.dataset.taskDel,1);store.set("tasks",tasks);renderTasks();}});renderTasks();
$("saveMemory").addEventListener("click",()=>{store.set("memoryNotes",$("memoryNotes").value);alert("Notes saved on this device.");});$("memoryNotes").value=store.get("memoryNotes","");
$("saveResearch").addEventListener("click",()=>{store.set("researchNotes",$("researchNotes").value);alert("Research notes saved.");});$("researchNotes").value=store.get("researchNotes","");
$("webSearchForm").addEventListener("submit",e=>{e.preventDefault();window.open("https://www.google.com/search?q="+encodeURIComponent($("webSearchQuery").value),"_blank","noopener");});
$("filePicker").addEventListener("change",e=>{$("fileInfo").textContent=[...e.target.files].map(f=>`${f.name} (${Math.round(f.size/1024)} KB)`).join(" • ")||"No files selected";});
function download(name,content,type){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
$("exportBackup").addEventListener("click",()=>download("nova-backup.json",JSON.stringify({money,tasks,social,memoryNotes:$("memoryNotes").value,researchNotes:$("researchNotes").value,businessNotes:$("businessNotes").value},null,2),"application/json"));
$("importBackup").addEventListener("change",async e=>{try{const d=JSON.parse(await e.target.files[0].text());for(const k of ["money","tasks","social","memoryNotes","researchNotes","businessNotes"])if(d[k]!==undefined)store.set(k,d[k]);$("backupStatus").textContent="Backup imported. Reload page to refresh all panels.";}catch{$("backupStatus").textContent="Invalid backup file.";}}); 
$("clearData").addEventListener("click",()=>{if(confirm("Is browser ka NOVA local data clear karein?")){Object.keys(localStorage).filter(k=>k.startsWith("nova_")).forEach(k=>localStorage.removeItem(k));location.reload();}});
let photo=null, photoCtx=$("photoCanvas").getContext("2d");
$("photoPicker").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;photo=new Image();photo.onload=drawPhoto;photo.src=URL.createObjectURL(f);});
function drawPhoto(){const c=$("photoCanvas");c.width=photo.naturalWidth;c.height=photo.naturalHeight;photoCtx.filter=`brightness(${$("brightness").value}%) contrast(${$("contrast").value}%) saturate($("saturation").value%)`;photoCtx.drawImage(photo,0,0);}
["brightness","contrast","saturation"].forEach(id=>$(id).addEventListener("input",()=>{if(photo)drawPhoto();}));
$("resetPhoto").addEventListener("click",()=>{["brightness","contrast","saturation"].forEach(id=>$(id).value=100);if(photo)drawPhoto();});
$("downloadPhoto").addEventListener("click",()=>{if(!$("photoCanvas").width)return alert("Pehle photo select karein.");$("photoCanvas").toBlob(b=>{const u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="nova-edited-photo.png";a.click();URL.revokeObjectURL(u);});});
$("videoPicker").addEventListener("change",e=>{const f=e.target.files[0];if(f)$("videoPreview").src=URL.createObjectURL(f);});

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
$("voiceStart").addEventListener("click",()=>{if(!SpeechRecognition){$("voiceState").textContent="Voice recognition is not supported in this browser.";return;}if(recognition)recognition.stop();speaking=true;recognition=new SpeechRecognition();recognition.lang="hi-IN";recognition.continuous=false;recognition.interimResults=false;recognition.onstart=()=>$("voiceState").textContent="LISTENING...";recognition.onresult=e=>{const text=e.results[0][0].transcript;$("message").value=text;sendMessage(text);};recognition.onerror=e=>$("voiceState").textContent="Voice error: "+e.error;recognition.onend=()=>$("voiceState").textContent="Voice ready";recognition.start();});
$("voiceStop").addEventListener("click",()=>{speaking=false;if(recognition)recognition.stop();if("speechSynthesis"in window)speechSynthesis.cancel();$("voiceState").textContent="RUKO • Voice stopped";});
let installPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installApp").hidden=false;});$("installApp").addEventListener("click",async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installApp").hidden=true;}});
if("serviceWorker"in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));


// AI-assisted research workspaces. Results are generated only when a configured AI provider is available.
const researchTasks = {
 market: () => ({out:'marketResult', prompt:`Create a structured market research brief. Region: ${$('marketRegion').value}. Industry/product: ${$('marketIndustry').value}. Goal: ${$('marketGoal').value}. Include assumptions, demand signals to verify, customer segments, pricing research, competitors, risks, sources to check, and a low-cost validation plan. Do not invent live statistics or claim web research was performed.`}),
 trade: () => ({out:'tradeResult', prompt:`Prepare an import/export feasibility research brief. Product: ${$('tradeProduct').value}. From: ${$('tradeFrom').value}. To: ${$('tradeTo').value}. Goal: ${$('tradeGoal').value}. Include likely research steps, HS-code verification, customs/tax/regulatory checks, logistics questions, buyer/supplier discovery, risks, and official sources to verify. Do not invent current duties or legal advice.`}),
 competitors: () => ({out:'competitorResult', prompt:`Prepare a competitor intelligence framework for: ${$('competitorBusiness').value}. Known competitors: ${$('competitorNames').value}. Use only public/business-appropriate information. Compare positioning, customer segments, pricing questions, strengths/weaknesses hypotheses, differentiation opportunities, and what must be verified. Clearly label unknowns; do not invent facts.`}),
 customers: () => ({out:'customersResult', prompt:`Research customer segments for product/service: ${$('customerProduct').value}. Region: ${$('customerRegion').value}. Customer type: ${$('customerType').value}. Provide ideal customer profiles, pains/jobs-to-be-done, buying triggers, discovery channels, interview questions, and a small validation experiment. Do not invent named leads or private contact details.`}),
 opportunities: () => ({out:'opportunitiesResult', prompt:`Create a ranked opportunity scan. Budget: ${$('oppBudget').value}. Skills/interests/time: ${$('oppSkills').value}. Market: ${$('oppMarket').value}. Prioritize low-cost experiments. For each idea include customer problem, proposed offer, startup costs to verify, first 3 steps, validation test, risks, and ethical/legal considerations. No income guarantees.`})
};
document.querySelectorAll('[data-ai-task]').forEach(btn=>btn.addEventListener('click',async()=>{
 const task=researchTasks[btn.dataset.aiTask](); const out=$(task.out); out.textContent='NOVA is preparing the brief...'; btn.disabled=true;
 try { const r=await fetch((backend||'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:task.prompt,history:[]})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'AI request failed'); out.textContent=d.reply||'No result returned.'; }
 catch(e){out.textContent='Not connected: '+e.message+' — configure a provider key in hosting settings first.';}
 finally{btn.disabled=false;}
}));
