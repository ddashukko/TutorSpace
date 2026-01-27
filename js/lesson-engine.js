const currentPath = window.location.pathname;
const currentLessonConfig = LESSONS.find((l) =>
  currentPath.includes(l.file),
) || { id: "debug", maxScore: 100, class: "8" };
const STORAGE_KEY = `tutor_progress_${localStorage.getItem("studentName")}_${currentLessonConfig.id}`;

let totalCorrect = 0;
let totalWrong = 0;
let isTestMode = false;

document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");
  if (!studentName) {
    alert("Будь ласка, увійдіть!");
    window.location.href = "../index.html";
    return;
  }

  let dataToRender = [];
  if (typeof LESSON_DATA !== "undefined") {
    document.title = LESSON_DATA.title;
    const headerTitle = document.getElementById("lesson-title-display");
    if (headerTitle) headerTitle.innerText = LESSON_DATA.title;
    dataToRender = LESSON_DATA.exercises;

    if (LESSON_DATA.type === "test") {
      isTestMode = true;
      document.body.classList.add("mode-test");
      const btnFinish = document.querySelector(".btn-finish");
      if (btnFinish) btnFinish.innerText = "Здати тест";
    }
  } else if (typeof exercises !== "undefined") {
    dataToRender = exercises;
  }

  renderBuilder(dataToRender);

  const localState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  restoreProgress(localState);
  loadServerProgress(studentName);

  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$", right: "$", display: false }],
    });
  }
});

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
        const serverState = JSON.parse(lastAttempt.details);
        const stats = document.querySelector(".stats-container");
        if (stats) stats.style.borderBottom = "3px solid #10b981";
        restoreProgress(serverState);
        if (isTestMode) {
          document.body.classList.add("checked");
          document.querySelector(".btn-finish").style.display = "none";
        }
      }
    }
  } catch (e) {
    console.warn("Offline/API Error:", e);
  }
}

function renderBuilder(data) {
  const root = document.getElementById("quiz-root");
  root.innerHTML = "";

  // 1. Рендеримо вправи (як і раніше)
  data.forEach((ex) => {
    const card = document.createElement("div");
    card.className = "exercise-block";
    let html = `<div class="exercise-header"><h3>${ex.title}</h3>${ex.desc ? `<p>${ex.desc}</p>` : ""}</div>`;

    if (ex.visual) {
      html += `<div style="padding: 20px;" class="cheat-content">${ex.visual}</div>`;
    }

    if (ex.tasks && ex.tasks.length > 0) {
      html += `<div class="task-list">`;
      ex.tasks.forEach((task) => {
        const uniqueId = `${ex.id}_${task.id}`;
        html += `<div class="task-row" data-uid="${uniqueId}"><div class="task-content"><span class="task-number">${task.id}</span><span>${task.q}</span></div><div>`;
        if (task.type === "input") {
          const answers = Array.isArray(task.a) ? task.a.join("|") : task.a;
          const safeAns = answers.replace(/"/g, "&quot;");
          html += `<div class="input-group">
                <input type="text" placeholder="..." 
                    onkeydown="if(event.key==='Enter') ${isTestMode ? "this.blur()" : "this.nextElementSibling.click()"}" 
                    onblur="${isTestMode ? `handleInput(this, '${safeAns}', true)` : ""}">
                ${!isTestMode ? `<button class="btn-check" onclick="handleInput(this, '${safeAns}')">ОК</button>` : ""}
            </div>`;
        } else {
          const opts = task.opts || ["Так", "Ні"];
          html += `<div class="options-container">`;
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

  // 2. Вставляємо кнопки навігації в НИЖНІЙ ФУТЕР
  renderFooterLinks();
}

function renderFooterLinks() {
  const footer = document.getElementById("lesson-footer");
  // Видаляємо старі посилання, якщо вони були (залишаємо тільки кнопку Finish)
  const existingLinks = footer.querySelectorAll(".btn-lesson-link");
  existingLinks.forEach((el) => el.remove());

  if (
    typeof LESSON_DATA !== "undefined" &&
    LESSON_DATA.links &&
    LESSON_DATA.links.length > 0
  ) {
    // Проходимось у зворотному порядку, щоб вставляти перед кнопкою Finish
    // або використовуємо prepend
    [...LESSON_DATA.links].reverse().forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.className = `btn-lesson-link ${link.type}`; // type: 'homework' або 'test'

      let icon = "🔗";
      if (link.type === "homework") icon = "🏠";
      if (link.type === "test") icon = "📝";

      a.innerHTML = `<span>${icon}</span> ${link.title}`;

      // Вставляємо ПЕРЕД першою дитиною (перед кнопкою Finish)
      footer.insertBefore(a, footer.firstChild);
    });
  }
}
function handleInput(element, correctStr, isBlur = false) {
  let input, btn;
  if (isBlur) {
    input = element;
    btn = { disabled: false };
  } else {
    const row = element.closest(".task-row");
    input = row.querySelector("input");
    btn = element;
  }

  const row = input.closest(".task-row");
  const uid = row.dataset.uid;
  const val = input.value.trim().replace(",", ".");

  if (!val) return;

  const answers = correctStr.split("|");
  const isCorrect = answers.includes(val);

  if (!isTestMode) {
    visualize(input, isCorrect);
    input.disabled = true;
    if (btn.tagName === "BUTTON") btn.disabled = true;
  }

  saveState(uid, { val, isCorrect, type: "input" });
  if (!isTestMode) recalcStats();
}

function handleOption(btn, isCorrect) {
  const row = btn.closest(".task-row");
  const uid = row.dataset.uid;
  const allBtns = row.querySelectorAll(".option-btn");

  if (allBtns[0].disabled && !isTestMode) return;

  const val = btn.dataset.val;
  const idx = btn.dataset.idx;

  allBtns.forEach((b) => {
    b.classList.remove(
      "selected-correct",
      "selected-wrong",
      "selected-neutral",
    );
    if (!isTestMode) b.disabled = true;
    else b.classList.remove("selected-neutral");
  });

  if (isTestMode) {
    btn.classList.add("selected-neutral");
    // In test mode we select, but enable re-selection until finish?
    // Let's allow simple selection, save state.
  } else {
    if (isCorrect) btn.classList.add("selected-correct");
    else btn.classList.add("selected-wrong");
  }

  saveState(uid, { val, idx, isCorrect, type: "option" });
  if (!isTestMode) recalcStats();
}

function visualize(el, isOk) {
  if (isOk) el.classList.add("correct");
  else el.classList.add("wrong");
}

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
        if (input) {
          input.value = saved.val;
          if (!isTestMode) {
            visualize(input, saved.isCorrect);
            input.disabled = true;
            const btn = row.querySelector(".btn-check");
            if (btn) btn.disabled = true;
          }
        }
      } else if (saved.type === "option") {
        const btns = row.querySelectorAll(".option-btn");
        btns.forEach((b) => {
          if (!isTestMode) b.disabled = true;
          if (saved.idx !== undefined && b.dataset.idx == saved.idx) {
            if (isTestMode) b.classList.add("selected-neutral");
            else
              b.classList.add(
                saved.isCorrect ? "selected-correct" : "selected-wrong",
              );
          } else if (!saved.idx && b.dataset.val === saved.val) {
            if (isTestMode) b.classList.add("selected-neutral");
            else
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
  if (isTestMode) {
    // In test mode we calculate from state, not DOM classes
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    totalCorrect = 0;
    totalWrong = 0;
    Object.values(state).forEach((item) => {
      if (item.isCorrect) totalCorrect++;
      else totalWrong++;
    });
  } else {
    totalCorrect = document.querySelectorAll(
      ".correct, .selected-correct",
    ).length;
    totalWrong = document.querySelectorAll(".wrong, .selected-wrong").length;
    const cEl = document.getElementById("val-correct");
    const wEl = document.getElementById("val-wrong");
    if (cEl) cEl.innerText = totalCorrect;
    if (wEl) wEl.innerText = totalWrong;
  }
}

function finishLesson() {
  recalcStats(); // Final calculation

  if (isTestMode) {
    if (
      !confirm(
        "Ви впевнені, що хочете здати тест? Змінити відповіді буде неможливо.",
      )
    )
      return;
    document.body.classList.add("checked");
    // Disable everything
    document.querySelectorAll("input").forEach((i) => (i.disabled = true));
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    // Re-enable finish button for modal actions (logic handled by modal overlay z-index)
  }

  const max = currentLessonConfig.maxScore || 1;
  const percent = Math.round((totalCorrect / max) * 100);

  const modalHTML = `
      <div id="resultModal" class="modal-overlay" style="display:flex">
        <div class="modal-content">
          <div class="modal-score-circle">${percent}%</div>
          <h2 class="modal-title">${isTestMode ? "Тест завершено" : "Результат"}</h2>
          <p class="modal-text">✅ ${totalCorrect} &nbsp;&nbsp; ❌ ${totalWrong}</p>
          <div class="modal-actions">
            <button class="btn-primary" onclick="submitResults()">💾 Зберегти результат</button>
            <button class="btn-secondary" onclick="retryLesson()">🔄 ${isTestMode ? "Перездати" : "Скинути"}</button>
            <button class="btn-secondary" onclick="document.getElementById('resultModal').style.display='none'">Закрити</button>
          </div>
        </div>
      </div>
    `;

  const existingModal = document.getElementById("resultModal");
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHTML);
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
