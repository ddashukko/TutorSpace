/* --- js/lesson-engine.js --- */

// --- 1. НАЛАШТУВАННЯ ТА ЗМІННІ ---
const currentPath = window.location.pathname;
// Шукаємо конфіг уроку по назві файлу
const currentLessonConfig = LESSONS.find((l) =>
  currentPath.includes(l.file),
) || { id: "debug", maxScore: 100, class: "8" };

// Ключ для локального збереження
const STORAGE_KEY = `tutor_progress_${localStorage.getItem("studentName")}_${currentLessonConfig.id}`;

let totalCorrect = 0;
let totalWrong = 0;

// --- 2. ЗАПУСК ПРИ ЗАВАНТАЖЕННІ ---
document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");

  // Перевірка входу
  if (!studentName) {
    alert("Будь ласка, увійдіть!");
    window.location.href = "../index.html";
    return;
  }

  // Визначення джерела даних (Шаблон або Старий формат)
  let dataToRender = [];
  if (typeof LESSON_DATA !== "undefined") {
    // Новий формат
    document.title = LESSON_DATA.title;
    const headerTitle = document.getElementById("lesson-title-display");
    if (headerTitle) headerTitle.innerText = LESSON_DATA.title;
    dataToRender = LESSON_DATA.exercises;
  } else if (typeof exercises !== "undefined") {
    // Старий формат
    dataToRender = exercises;
  }

  // Побудова уроку
  renderBuilder(dataToRender);

  // КРОК 1: Відновлюємо локальну чернетку
  const localState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  restoreProgress(localState);

  // КРОК 2: Завантажуємо з сервера (для перегляду вчителем)
  loadServerProgress(studentName);

  // Рендер формул (Katex)
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$", right: "$", display: false }],
    });
  }
});

// --- 3. ФУНКЦІЯ ЗАВАНТАЖЕННЯ З СЕРВЕРА ---
async function loadServerProgress(studentName) {
  if (typeof API_URL === "undefined" || !API_URL) return;

  try {
    console.log("Синхронізація з сервером...");
    const response = await fetch(
      `${API_URL}?studentName=${encodeURIComponent(studentName)}`,
    );
    const data = await response.json();

    const attempts = data.filter((d) => d.lessonId === currentLessonConfig.id);

    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1];

      if (lastAttempt.details) {
        let serverState = {};
        try {
          serverState = JSON.parse(lastAttempt.details);
        } catch (e) {
          console.error("Некоректний JSON з сервера", e);
          return;
        }

        const statsContainer = document.querySelector(".stats-container");
        if (statsContainer) {
          statsContainer.style.border = "2px solid #10b981";
          statsContainer.title = "Відображається результат з сервера";
        }

        restoreProgress(serverState);
        console.log("Дані завантажено!");
      }
    }
  } catch (e) {
    console.warn("Офлайн режим або помилка API:", e);
  }
}

// --- 4. БУДІВЕЛЬНИК (З ВИПРАВЛЕННЯМ ДЛЯ LaTeX) ---
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
          // Екрануємо лапки, щоб не ламало HTML
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
          opts.forEach((opt) => {
            const isCorrect = opt === task.a;

            // ВАЖЛИВО: Зберігаємо значення в data-val, екрануючи лапки
            // Це дозволяє зберігати LaTeX формули без помилок
            const safeVal = opt.replace(/"/g, "&quot;");

            html += `<button class="option-btn" data-val="${safeVal}" onclick="handleOption(this, ${isCorrect})">${opt}</button>`;
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

// --- 5. ОБРОБКА ДІЙ (З ВИПРАВЛЕННЯМ) ---

function handleInput(btn, correctStr) {
  const row = btn.closest(".task-row");
  const input = row.querySelector("input");
  const uid = row.dataset.uid;

  if (input.disabled) return;

  const val = input.value.trim().replace(",", ".");
  const answers = correctStr.split("|");
  const isCorrect = answers.includes(val);

  if (isCorrect) input.classList.add("correct");
  else input.classList.add("wrong");

  input.disabled = true;
  btn.disabled = true;

  saveState(uid, val, isCorrect, "input");
  recalcStats();
}

function handleOption(btn, isCorrect) {
  const row = btn.closest(".task-row");
  const uid = row.dataset.uid;
  const allBtns = row.querySelectorAll(".option-btn");

  if (allBtns[0].disabled) return;

  // ВАЖЛИВО: Беремо значення з data-val (там воно чисте і правильне)
  const val = btn.dataset.val;

  allBtns.forEach((b) => (b.disabled = true));

  if (isCorrect) btn.classList.add("selected-correct");
  else btn.classList.add("selected-wrong");

  saveState(uid, val, isCorrect, "option");
  recalcStats();
}

// --- 6. ЗБЕРЕЖЕННЯ ТА ВІДНОВЛЕННЯ ---

function saveState(uid, val, isCorrect, type) {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state[uid] = { val, isCorrect, type };
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
          input.classList.remove("correct", "wrong");
          input.classList.add(saved.isCorrect ? "correct" : "wrong");
          input.disabled = true;
          btn.disabled = true;
        }
      } else if (saved.type === "option") {
        const btns = row.querySelectorAll(".option-btn");
        btns.forEach((b) => {
          b.disabled = true;
          b.classList.remove("selected-correct", "selected-wrong");

          // ВАЖЛИВО: Порівнюємо з data-val, щоб розпізнати LaTeX формули
          if (b.dataset.val === saved.val) {
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

  const correctEl = document.getElementById("val-correct");
  const wrongEl = document.getElementById("val-wrong");
  if (correctEl) correctEl.innerText = totalCorrect;
  if (wrongEl) wrongEl.innerText = totalWrong;
}

// --- 7. ЗАВЕРШЕННЯ УРОКУ ---

function finishLesson() {
  const max = currentLessonConfig.maxScore || 1;
  const percent = Math.round((totalCorrect / max) * 100);

  if (!document.getElementById("resultModal")) {
    const modalHTML = `
      <div id="resultModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-score-circle">
            ${percent}%
          </div>
          <h2 class="modal-title">Урок завершено!</h2>
          <p class="modal-text">
            Правильних відповідей: <b>${totalCorrect}</b><br>
            Помилок: <b style="color:var(--error)">${totalWrong}</b>
          </p>
          <div class="modal-actions">
            <button class="btn-primary" onclick="submitResults()">💾 Зберегти результат</button>
            <button class="btn-secondary" onclick="retryLesson()">🔄 Пройти ще раз (Скинути)</button>
            <button class="btn-secondary" onclick="document.getElementById('resultModal').style.display='none'" style="border:none">Повернутись</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
  } else {
    document.querySelector(".modal-score-circle").innerText = `${percent}%`;
    document.querySelector(".modal-text").innerHTML = `
        Правильних відповідей: <b>${totalCorrect}</b><br>
        Помилок: <b style="color:var(--error)">${totalWrong}</b>
    `;
  }

  document.getElementById("resultModal").style.display = "flex";
}

async function submitResults() {
  const btn = document.querySelector(".btn-primary");
  const oldText = btn.innerText;
  btn.innerText = "Збереження...";
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
    alert("Результат успішно збережено в хмару!");
    window.location.href = "../index.html";
  } catch (e) {
    alert("Помилка з'єднання. Перевірте інтернет.");
    btn.innerText = oldText;
    btn.disabled = false;
  }
}

async function retryLesson() {
  if (
    !confirm(
      "Увага! Це видалить ваш попередній результат з таблиці. Продовжити?",
    )
  )
    return;

  const btns = document.querySelectorAll(".modal-actions button");
  btns.forEach((b) => (b.disabled = true));

  localStorage.removeItem(STORAGE_KEY);

  const data = {
    action: "reset",
    studentName: localStorage.getItem("studentName"),
    lessonId: currentLessonConfig.id,
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    location.reload();
  } catch (e) {
    alert("Сервер не відповідає, але локальний прогрес скинуто.");
    location.reload();
  }
}
