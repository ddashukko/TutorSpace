/* --- js/lesson-engine.js --- */

// --- 1. ІНІЦІАЛІЗАЦІЯ ---
const currentPath = window.location.pathname;
const currentLessonConfig = LESSONS.find((l) =>
  currentPath.includes(l.file),
) || { id: "debug", maxScore: 100, class: "8" };

// Ключ для локального збереження відповідей
const STORAGE_KEY = `tutor_progress_${localStorage.getItem("studentName")}_${currentLessonConfig.id}`;

let totalCorrect = 0;
let totalWrong = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Перевірка входу
  if (!localStorage.getItem("studentName")) {
    alert("Будь ласка, увійдіть!");
    window.location.href = "../index.html";
    return;
  }
  // --- НОВЕ: Автоматична вставка заголовку ---
  // Якщо в HTML є змінна LESSON_DATA, беремо назву звідти
  if (typeof LESSON_DATA !== "undefined") {
    // Міняємо заголовок вкладки браузера
    document.title = LESSON_DATA.title;
    // Міняємо заголовок в шапці (знаходимо елемент за ID)
    const headerTitle = document.getElementById("lesson-title-display");
    if (headerTitle) headerTitle.innerText = LESSON_DATA.title;

    // Запускаємо побудову завдань
    renderBuilder(LESSON_DATA.exercises);
    restoreProgress();
  }
  // Підтримка старого формату (якщо раптом десь залишився const exercises)
  else if (typeof exercises !== "undefined") {
    renderBuilder(exercises);
    restoreProgress();
  }
  // -------------------------------------------

  // Запускаємо математику (Katex)
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$", right: "$", display: false }],
    });
  }
});

/* --- Оновлена функція для js/lesson-engine.js --- */

function renderBuilder(data) {
  const root = document.getElementById("quiz-root");
  root.innerHTML = "";

  data.forEach((ex) => {
    const card = document.createElement("div");
    card.className = "exercise-block";

    // 1. Заголовок і опис
    let html = `
            <div class="exercise-header">
                <h3>${ex.title}</h3>
                ${ex.desc ? `<p>${ex.desc}</p>` : ""} 
            </div>
        `;

    // 2. Візуальна частина (сюди піде текст шпаргалки)
    // Додаємо клас cheat-content для гарного форматування списків
    if (ex.visual) {
      html += `<div style="padding: 20px;" class="cheat-content">${ex.visual}</div>`;
    }

    // 3. Завдання (генеруємо тільки якщо вони є)
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
          html += `
                    <div class="input-group">
                        <input type="text" placeholder="..." onkeydown="if(event.key==='Enter') this.nextElementSibling.click()">
                        <button class="btn-check" onclick="handleInput(this, '${answers}')">ОК</button>
                    </div>
                `;
        } else {
          const opts = task.opts || ["Так", "Ні"];
          html += `<div class="options-container">`;
          opts.forEach((opt) => {
            const isCorrect = opt === task.a;
            html += `<button class="option-btn" onclick="handleOption(this, ${isCorrect}, '${opt}')">${opt}</button>`;
          });
          html += `</div>`;
        }
        html += `</div></div>`;
      });
      html += `</div>`; // Закриваємо task-list
    }

    card.innerHTML = html;
    root.appendChild(card);
  });
}

// --- 3. ОБРОБКА ВІДПОВІДЕЙ ---
function handleInput(btn, correctStr) {
  const row = btn.closest(".task-row");
  const input = row.querySelector("input");
  const uid = row.dataset.uid;

  if (input.disabled) return;

  const val = input.value.trim().replace(",", ".");
  const answers = correctStr.split("|");
  const isCorrect = answers.includes(val);

  if (isCorrect) {
    input.classList.add("correct");
    totalCorrect++;
  } else {
    input.classList.add("wrong");
    totalWrong++;
  }

  input.disabled = true;
  btn.disabled = true;
  saveState(uid, val, isCorrect, "input");
  updateHeaderStats();
}

function handleOption(btn, isCorrect, val) {
  const row = btn.closest(".task-row");
  const uid = row.dataset.uid;
  const allBtns = row.querySelectorAll(".option-btn");

  if (allBtns[0].disabled) return;

  allBtns.forEach((b) => (b.disabled = true));

  if (isCorrect) {
    btn.classList.add("selected-correct");
    totalCorrect++;
  } else {
    btn.classList.add("selected-wrong");
    totalWrong++;
  }

  saveState(uid, val, isCorrect, "option");
  updateHeaderStats();
}

// --- 4. ЗБЕРЕЖЕННЯ ПРОГРЕСУ (LOCAL) ---
function saveState(uid, val, isCorrect, type) {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state[uid] = { val, isCorrect, type };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreProgress() {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  document.querySelectorAll(".task-row").forEach((row) => {
    const uid = row.dataset.uid;
    const saved = state[uid];
    if (saved) {
      if (saved.isCorrect) totalCorrect++;
      else totalWrong++;

      if (saved.type === "input") {
        const input = row.querySelector("input");
        const btn = row.querySelector(".btn-check");
        input.value = saved.val;
        input.classList.add(saved.isCorrect ? "correct" : "wrong");
        input.disabled = true;
        btn.disabled = true;
      } else if (saved.type === "option") {
        const btns = row.querySelectorAll(".option-btn");
        btns.forEach((b) => {
          b.disabled = true;
          if (b.innerText === saved.val) {
            b.classList.add(
              saved.isCorrect ? "selected-correct" : "selected-wrong",
            );
          }
        });
      }
    }
  });
  updateHeaderStats();
}

function updateHeaderStats() {
  const correctEl = document.getElementById("val-correct");
  const wrongEl = document.getElementById("val-wrong");
  if (correctEl) correctEl.innerText = totalCorrect;
  if (wrongEl) wrongEl.innerText = totalWrong;
}

// --- 5. ЛОГІКА ЗАВЕРШЕННЯ (НОВА) ---

// Ця функція викликається кнопкою "Завершити урок" в HTML
function finishLesson() {
  // Рахуємо відсоток
  const max = currentLessonConfig.maxScore || 1; // Захист від ділення на 0
  const percent = Math.round((totalCorrect / max) * 100);

  // Якщо модалка ще не створена, додаємо її в HTML
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
            <button class="btn-secondary" onclick="retryLesson()">🔄 Пройти ще раз (скинути)</button>
            <button class="btn-secondary" onclick="document.getElementById('resultModal').style.display='none'" style="border:none">Повернутись до завдань</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
  } else {
    // Оновлюємо цифри, якщо модалка вже була
    document.querySelector(".modal-score-circle").innerText = `${percent}%`;
    document.querySelector(".modal-text").innerHTML = `
        Правильних відповідей: <b>${totalCorrect}</b><br>
        Помилок: <b style="color:var(--error)">${totalWrong}</b>
    `;
  }

  // Показуємо модалку
  document.getElementById("resultModal").style.display = "flex";
}

// Відправка даних на Google Sheets
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
    alert("Успішно збережено!");
    window.location.href = "../index.html";
  } catch (e) {
    alert("Помилка з'єднання. Перевірте інтернет.");
    btn.innerText = oldText;
    btn.disabled = false;
  }
}

// Видалення даних і рестарт
async function retryLesson() {
  if (
    !confirm(
      "Це видалить ваш попередній результат з таблиці та очистить всі відповіді тут. Продовжити?",
    )
  )
    return;

  const btns = document.querySelectorAll(".modal-actions button");
  btns.forEach((b) => (b.disabled = true));
  btns[1].innerText = "Очищення...";

  // 1. Чистимо браузер
  localStorage.removeItem(STORAGE_KEY);

  // 2. Чистимо таблицю (сервер)
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
    // Перезавантажуємо сторінку
    location.reload();
  } catch (e) {
    alert("Не вдалося з'єднатися з сервером, але локальний прогрес скинуто.");
    location.reload();
  }
}
