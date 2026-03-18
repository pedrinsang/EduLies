import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA5bn85sy036cJDAJhZRTU3Z3PdkaZi3lY",
  authDomain: "atmv117.firebaseapp.com",
  projectId: "atmv117",
  storageBucket: "atmv117.firebasestorage.app",
  messagingSenderId: "262893477859",
  appId: "1:262893477859:web:322fac6968389050abcad6",
  measurementId: "G-WTV7S63HR2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const liesDocRef = doc(db, "counters", "eduLies");
const LOCAL_STORAGE_KEY = "edu-lies-counter";

// Analytics can fail in non-supported contexts (for example, file://).
try {
  getAnalytics(app);
} catch (error) {
  console.warn("Firebase Analytics indisponivel neste ambiente:", error);
}

const countElement = document.getElementById("count");
const addButton = document.getElementById("add-lie");
const resetButton = document.getElementById("reset");

let liesCount = 0;
let canUseFirebase = true;

function updateCount() {
  countElement.textContent = String(liesCount);
}

function loadLocalCounter() {
  const rawValue = localStorage.getItem(LOCAL_STORAGE_KEY);
  const parsedValue = Number(rawValue);

  if (Number.isFinite(parsedValue) && parsedValue >= 0) {
    liesCount = parsedValue;
  }
}

function saveLocalCounter() {
  localStorage.setItem(LOCAL_STORAGE_KEY, String(liesCount));
}

function setButtonsEnabled(enabled) {
  addButton.disabled = !enabled;
  resetButton.disabled = !enabled;
}

async function loadCounter() {
  try {
    const snapshot = await getDoc(liesDocRef);

    if (snapshot.exists()) {
      const savedCount = snapshot.data().count;
      if (typeof savedCount === "number" && Number.isFinite(savedCount)) {
        liesCount = savedCount;
      }
    }
  } catch (error) {
    canUseFirebase = false;
    loadLocalCounter();
    console.error("Erro ao carregar contador no Firebase:", error);
    console.warn("Usando contador local por falta de permissao no Firestore.");
  } finally {
    updateCount();
    setButtonsEnabled(true);
  }
}

async function saveCounter() {
  saveLocalCounter();

  if (!canUseFirebase) {
    return;
  }

  try {
    await setDoc(liesDocRef, {
      count: liesCount,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    canUseFirebase = false;
    console.error("Erro ao salvar contador no Firebase:", error);
    console.warn("Salvamento mantido apenas no navegador (localStorage).");
  }
}

setButtonsEnabled(false);
void loadCounter();

addButton.addEventListener("click", () => {
  liesCount += 1;
  updateCount();
  void saveCounter();
});

resetButton.addEventListener("click", () => {
  liesCount = 0;
  updateCount();
  void saveCounter();
});
