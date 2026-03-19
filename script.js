import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ── Firebase config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA5bn85sy036cJDAJhZRTU3Z3PdkaZi3lY",
  authDomain: "atmv117.firebaseapp.com",
  projectId: "atmv117",
  storageBucket: "atmv117.firebasestorage.app",
  messagingSenderId: "262893477859",
  appId: "1:262893477859:web:322fac6968389050abcad6",
  measurementId: "G-WTV7S63HR2"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const liesDocRef = doc(db, "counters", "eduLies");
const LOCAL_KEY   = "edu-lies-v2";

try { getAnalytics(app); } catch (e) {
  console.warn("Firebase Analytics indisponível:", e);
}

// ── State ────────────────────────────────────────────────────────────────────
let lies        = [];   // [{ id, desc, timestamp }]
let canFirebase = true;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const countEl   = document.getElementById("count");
const lieDescEl = document.getElementById("lie-desc");
const charCount = document.getElementById("char-count");
const addBtn    = document.getElementById("add-lie");
const resetBtn  = document.getElementById("reset");
const lieList   = document.getElementById("lie-list");
const emptyState= document.getElementById("empty-state");
const listCount = document.getElementById("list-count");
const toast     = document.getElementById("toast");

// ── Utils ────────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  // Contador
  countEl.textContent = lies.length;

  // Badge
  const n = lies.length;
  listCount.textContent = n === 0 ? "0 registros" :
                          n === 1 ? "1 registro"  :
                          `${n} registros`;

  // Empty state
  emptyState.style.display = lies.length === 0 ? "flex" : "none";

  // Remover itens antigos do DOM (não-empty-state)
  const oldItems = lieList.querySelectorAll(".lie-item");
  oldItems.forEach(el => el.remove());

  // Renderizar em ordem reversa (mais recente no topo)
  [...lies].reverse().forEach((lie, revIdx) => {
    const realNumber = lies.length - revIdx; // número sequencial real
    const li = buildLieItem(lie, realNumber);
    lieList.appendChild(li);
  });

  // Atualizar badge da tab
  if (typeof updateTabBadge === 'function') updateTabBadge();
}

function buildLieItem(lie, number) {
  const li = document.createElement("li");
  li.className = "lie-item";
  li.dataset.id = lie.id;

  const hasDesc = lie.desc && lie.desc.trim().length > 0;

  li.innerHTML = `
    <div class="lie-number">${number}</div>
    <div class="lie-body">
      <p class="lie-desc ${hasDesc ? "" : "no-desc"}">
        ${hasDesc ? escapeHtml(lie.desc.trim()) : "sem descrição"}
      </p>
      <p class="lie-time">${formatTime(lie.timestamp)}</p>
    </div>
    <button class="btn-delete" aria-label="Excluir mentira ${number}" title="Excluir">✕</button>
  `;

  li.querySelector(".btn-delete").addEventListener("click", () => deleteLie(lie.id));
  return li;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Animação de bump no número
function bumpCount() {
  countEl.classList.remove("bump");
  void countEl.offsetWidth; // reflow
  countEl.classList.add("bump");
  setTimeout(() => countEl.classList.remove("bump"), 300);
}

// ── Persistência ─────────────────────────────────────────────────────────────
function toFirebaseData() {
  return { lies, updatedAt: new Date().toISOString() };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.lies)) lies = data.lies;
  } catch (e) {
    console.warn("Erro ao ler localStorage:", e);
  }
}

function saveLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(toFirebaseData()));
  } catch (e) {
    console.warn("Erro ao salvar localStorage:", e);
  }
}

async function loadCounter() {
  try {
    const snapshot = await getDoc(liesDocRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (Array.isArray(data.lies)) {
        lies = data.lies;
      } else if (typeof data.count === "number") {
        // Migração: contador antigo sem lista → cria entradas genéricas
        lies = Array.from({ length: data.count }, (_, i) => ({
          id: uid(),
          desc: "",
          timestamp: new Date(Date.now() - (data.count - i) * 60000).toISOString()
        }));
      }
    }
  } catch (e) {
    canFirebase = false;
    loadLocal();
    console.error("Erro ao carregar do Firebase:", e);
  } finally {
    renderAll();
    setButtons(true);
  }
}

async function saveCounter() {
  saveLocal();
  if (!canFirebase) return;
  try {
    await setDoc(liesDocRef, toFirebaseData());
  } catch (e) {
    canFirebase = false;
    console.error("Erro ao salvar no Firebase:", e);
  }
}

function setButtons(enabled) {
  addBtn.disabled    = !enabled;
  resetBtn.disabled  = !enabled;
}

// ── Actions ──────────────────────────────────────────────────────────────────
function addLie() {
  const desc = lieDescEl.value.slice(0, 120);
  lies.push({ id: uid(), desc, timestamp: new Date().toISOString() });
  lieDescEl.value = "";
  charCount.textContent = "0/120";
  bumpCount();
  renderAll();
  void saveCounter();
  showToast("Mentira registrada! 🤥");
}

function deleteLie(id) {
  const li = lieList.querySelector(`[data-id="${id}"]`);
  if (li) {
    li.classList.add("removing");
    li.addEventListener("animationend", () => {
      lies = lies.filter(l => l.id !== id);
      renderAll();
      void saveCounter();
      showToast("Mentira removida.");
    }, { once: true });
  }
}

function resetAll() {
  if (!confirm("Tem certeza? Isso vai zerar o contador e apagar todas as mentiras.")) return;
  lies = [];
  renderAll();
  void saveCounter();
  showToast("Contador zerado.");
}

// ── Char counter ─────────────────────────────────────────────────────────────
lieDescEl.addEventListener("input", () => {
  charCount.textContent = `${lieDescEl.value.length}/120`;
});

lieDescEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addLie(); }
});

// ── Tab bar (mobile) ──────────────────────────────────────────────────────────
const tabBtns  = document.querySelectorAll(".tab-btn");
const panels   = document.querySelectorAll(".panel[data-panel]");
const tabBadge = document.getElementById("tab-badge");

function isMobile() {
  return window.matchMedia("(max-width: 780px)").matches;
}

function initPanels() {
  if (!isMobile()) {
    panels.forEach(p => p.classList.remove("active-panel", "hidden-panel"));
    return;
  }
  const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab || "counter";
  panels.forEach(p => {
    const isActive = p.dataset.panel === activeTab;
    p.classList.toggle("active-panel", isActive);
    p.classList.toggle("hidden-panel", !isActive);
  });
}

function updateTabBadge() {
  if (!tabBadge) return;
  const n = lies.length;
  tabBadge.textContent = n;
  tabBadge.classList.toggle("hidden", n === 0);
}

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    initPanels();
  });
});

window.addEventListener("resize", initPanels);

// ── Bindings ─────────────────────────────────────────────────────────────────
addBtn.addEventListener("click", addLie);
resetBtn.addEventListener("click", resetAll);

// ── Init ─────────────────────────────────────────────────────────────────────
setButtons(false);
initPanels();
void loadCounter();