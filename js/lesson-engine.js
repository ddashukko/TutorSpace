/* --- js/lesson-engine.js --- */

// --- 1. НАЛАШТУВАННЯ ТА ЗМІННІ ---
const currentPath = window.location.pathname;
const currentLessonConfig = LESSONS.find((l) =>
  currentPath.includes(l.file),
) || { id: "debug", maxScore: 100, class: "8" };

const STORAGE_KEY = `tutor_progress_${localStorage.getItem("studentName")}_${currentLessonConfig.id}`;

let totalCorrect = 0;
let totalWrong = 0;

// --- 2. ЗАПУСК ---
document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");

  if (!studentName) {
    alert("Будь ласка, увійдіть!");
    window.location.href = "../index.html";
    return;
  }

  // Визначаємо дані
  let dataToRender = [];
  if (typeof LESSON_DATA !== "undefined") {
    document.title = LESSON_DATA.title;
    const headerTitle = document.getElementById("lesson-title-display");
    if (headerTitle) headerTitle.innerText = LESSON_DATA.title;
    dataToRender = LESSON_DATA.exercises;
  } else if (typeof exercises !== "undefined") {
    dataToRender = exercises;
  }

  // 1. Будуємо HTML
  renderBuilder(dataToRender);

  // 2. Відновлюємо збережене (Локально)
  const localState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  restoreProgress(localState);

  // 3. Відновлюємо з Сервера (Хмара)
  loadServerProgress(studentName);

  // 4. Малюємо формули
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$", right: "$", display: false }],
    });
  }
});

// --- 3. СЕРВЕРНА СИНХРОНІЗАЦІЯ ---
async function loadServerProgress(studentName) {
  if (typeof API_URL === "undefined" || !API_URL) return;

  try {
    const response = await fetch(
      `${API_URL}?studentName=${encodeURIComponent(studentName)}`,
    );
    const data = await response.json();
    const attempts = data.filter((d) => d.lessonId === currentLessonConfig.id);

    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1];
      if (lastAttempt.details) {
        try {
          const serverState = JSON.parse(lastAttempt.details);
          // Підсвічуємо, що це серверні дані
          const stats = document.querySelector(".stats-container");
          if (stats) stats.style.borderBottom = "3px solid #10b981";

          restoreProgress(serverState);
        } catch (e) {
          console.error("JSON Error:", e);
        }
      }
    }
  } catch (e) {
    console.warn("Offline/API Error:", e);
  }
}

// --- 4. БУДІВЕЛЬНИК (З НОМЕРАМИ КНОПОК) ---
function renderBuilder(data) {
  const root = document.getElementById("quiz-root");
  root.innerHTML = "";

  data.forEach((ex) => {
    const card = document.createElement("div");
    card.className = "exercise-block";

    let html = `
        <div class="exercise-header">
            <h3>${ex.title}</h3>
            ${ex.desc ? `<p>${ex.desc}</p>` : ""}
        </div>
    `;

    if (ex.visual) {
      html += `<div style="padding: 20px;" class="cheat-content">${ex.visual}</div>`;
    }

    if (ex.tasks && ex.tasks.length > 0) {
      html += `<div class="task-list">`;
      ex.tasks.forEach((task) => {
        const uniqueId = `${ex.id}_${task.id}`;
        html += `
            <div class="task-row" data-uid="${uniqueId}">
                <div class="task-content">
                    <span class="task-number">${task.id}</span>
                    <span>${task.q}</span>
                </div>
                <div>
        `;

        if (task.type === "input") {
          const answers = Array.isArray(task.a) ? task.a.join("|") : task.a;
          const safeAns = answers.replace(/"/g, "&quot;");
          html += `
                <div class="input-group">
                    <input type="text" placeholder="..." onkeydown="if(event.key==='Enter') this.nextElementSibling.click()">
                    <button class="btn-check" onclick="handleInput(this, '${safeAns}')">ОК</button>
                </div>
            `;
        } else {
          const opts = task.opts || ["Так", "Ні"];
          html += `<div class="options-container">`;

          // !!! ТУТ МАГІЯ: Додаємо індекс (номер) кнопки (0, 1, 2...)
          opts.forEach((opt, idx) => {
            const isCorrect = opt === task.a;
            const safeVal = opt.replace(/"/g, "&quot;");

            html += `<button class="option-btn" data-idx="${idx}" data-val="${safeVal}" onclick="handleOption(this, ${isCorrect})">${opt}</button>`;
          });
          html += `</div>`;
        }
        html += `</div></div>`;
      });
      html += `</div>`;
    }

    card.innerHTML = html;
    root.appendChild(card);
  });
}

// --- 5. ОБРОБКА ДІЙ ---

function handleInput(btn, correctStr) {
  const row = btn.closest(".task-row");
  const input = row.querySelector("input");
  const uid = row.dataset.uid;

  if (input.disabled) return;

  const val = input.value.trim().replace(",", ".");
  const answers = correctStr.split("|");
  const isCorrect = answers.includes(val);

  visualize(input, isCorrect);
  input.disabled = true;
  btn.disabled = true;

  saveState(uid, { val, isCorrect, type: "input" });
  recalcStats();
}

function handleOption(btn, isCorrect) {
  const row = btn.closest(".task-row");
  const uid = row.dataset.uid;
  const allBtns = row.querySelectorAll(".option-btn");

  if (allBtns[0].disabled) return;

  // Зберігаємо і текст, і НОМЕР кнопки
  const val = btn.dataset.val;
  const idx = btn.dataset.idx;

  allBtns.forEach((b) => (b.disabled = true));

  if (isCorrect) btn.classList.add("selected-correct");
  else btn.classList.add("selected-wrong");

  // Зберігаємо index! Це найнадійніше.
  saveState(uid, { val, idx, isCorrect, type: "option" });
  recalcStats();
}

// Допоміжна функція візуалізації
function visualize(el, isOk) {
  if (isOk) el.classList.add("correct");
  else el.classList.add("wrong");
}

// --- 6. ЗБЕРЕЖЕННЯ ТА ВІДНОВЛЕННЯ ---

function saveState(uid, dataObj) {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state[uid] = dataObj;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreProgress(state) {
  if (!state) return;

  document.querySelectorAll(".task-row").forEach((row) => {
    const uid = row.dataset.uid;
    const saved = state[uid];

    if (saved) {
      if (saved.type === "input") {
        const input = row.querySelector("input");
        const btn = row.querySelector(".btn-check");
        if (input && btn) {
          input.value = saved.val;
          visualize(input, saved.isCorrect);
          input.disabled = true;
          btn.disabled = true;
        }
      } else if (saved.type === "option") {
        const btns = row.querySelectorAll(".option-btn");
        btns.forEach((b) => {
          b.disabled = true; // Блокуємо всі
          b.classList.remove("selected-correct", "selected-wrong");

          // 1. Спроба відновити по НОМЕРУ (найнадійніше)
          if (saved.idx !== undefined && b.dataset.idx == saved.idx) {
            b.classList.add(
              saved.isCorrect ? "selected-correct" : "selected-wrong",
            );
          }
          // 2. Якщо це старий запис без номера - пробуємо по тексту (резерв)
          else if (!saved.idx && b.dataset.val === saved.val) {
            b.classList.add(
              saved.isCorrect ? "selected-correct" : "selected-wrong",
            );
          }
        });
      }
    }
  });

  recalcStats();
}

function recalcStats() {
  totalCorrect = document.querySelectorAll(
    ".correct, .selected-correct",
  ).length;
  totalWrong = document.querySelectorAll(".wrong, .selected-wrong").length;

  const cEl = document.getElementById("val-correct");
  const wEl = document.getElementById("val-wrong");
  if (cEl) cEl.innerText = totalCorrect;
  if (wEl) wEl.innerText = totalWrong;
}

// --- 7. ЗАВЕРШЕННЯ ---

function finishLesson() {
  const max = currentLessonConfig.maxScore || 1;
  const percent = Math.round((totalCorrect / max) * 100);

  if (!document.getElementById("resultModal")) {
    const modalHTML = `
      <div id="resultModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-score-circle">${percent}%</div>
          <h2 class="modal-title">Результат</h2>
          <p class="modal-text">✅ ${totalCorrect} &nbsp;&nbsp; ❌ ${totalWrong}</p>
          <div class="modal-actions">
            <button class="btn-primary" onclick="submitResults()">💾 Зберегти</button>
            <button class="btn-secondary" onclick="retryLesson()">🔄 Скинути</button>
            <button class="btn-secondary" onclick="document.getElementById('resultModal').style.display='none'">Закрити</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
  } else {
    document.querySelector(".modal-score-circle").innerText = `${percent}%`;
    document.querySelector(".modal-text").innerHTML =
      `✅ ${totalCorrect} &nbsp;&nbsp; ❌ ${totalWrong}`;
  }
  document.getElementById("resultModal").style.display = "flex";
}

async function submitResults() {
  const btn = document.querySelector(".btn-primary");
  const oldText = btn.innerText;
  btn.innerText = "⏳...";
  btn.disabled = true;

  const data = {
    action: "submit",
    studentName: localStorage.getItem("studentName"),
    lessonId: currentLessonConfig.id,
    classLevel: currentLessonConfig.class,
    score: totalCorrect,
    maxScore: currentLessonConfig.maxScore,
    details: JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    alert("Збережено!");
    window.location.href = "../index.html";
  } catch (e) {
    alert("Помилка інтернету");
    btn.innerText = oldText;
    btn.disabled = false;
  }
}

async function retryLesson() {
  if (!confirm("Видалити старий результат?")) return;

  localStorage.removeItem(STORAGE_KEY);

  try {
    const data = {
      action: "reset",
      studentName: localStorage.getItem("studentName"),
      lessonId: currentLessonConfig.id,
    };
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {}

  location.reload();
}
