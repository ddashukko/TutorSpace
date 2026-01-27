const currentPath = window.location.pathname;
const currentLessonConfig = (typeof LESSONS !== "undefined"
  ? LESSONS.find((l) => currentPath.includes(l.file))
  : null) || { id: "debug", maxScore: 100, class: "8" };
const STORAGE_KEY = `tutor_progress_${localStorage.getItem("studentName")}_${currentLessonConfig.id}`;

let totalCorrect = 0;
let totalWrong = 0;
let isTestMode = false;

document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");

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
    } else if (LESSON_DATA.type === "homework") {
      document.body.classList.add("mode-homework");
    }
  }

  renderBuilder(dataToRender);
  const localState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  restoreProgress(localState);

  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$", right: "$", display: false }],
      throwOnError: false,
    });
  }
});

function renderBuilder(data) {
  const root = document.getElementById("quiz-root");
  root.innerHTML = "";

  data.forEach((ex) => {
    const card = document.createElement("div");
    card.className = "exercise-block";
    let html = `<div class="exercise-header"><h3>${ex.title}</h3>${ex.desc ? `<p>${ex.desc}</p>` : ""}</div>`;
    if (ex.visual)
      html += `<div style="padding: 20px;" class="cheat-content">${ex.visual}</div>`;

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

  renderFooterLinks();
}

function renderFooterLinks() {
  const footer = document.getElementById("lesson-footer");
  if (!footer) return;
  const existingLinks = footer.querySelectorAll(".btn-lesson-link");
  existingLinks.forEach((el) => el.remove());

  if (
    typeof LESSON_DATA !== "undefined" &&
    LESSON_DATA.links &&
    LESSON_DATA.links.length > 0
  ) {
    [...LESSON_DATA.links].reverse().forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.className = `btn-lesson-link ${link.type}`;
      let icon = "🔗";
      if (link.type === "homework") icon = "🏠";
      if (link.type === "test") icon = "📝";
      if (link.type === "lesson") icon = "📚";

      a.innerHTML = `<span>${icon}</span> ${link.title}`;
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
    input = element.closest(".task-row").querySelector("input");
    btn = element;
  }

  const row = input.closest(".task-row");
  const uid = row.dataset.uid;
  const val = input.value.trim().replace(",", ".");

  if (!val && !isTestMode) return;

  const answers = correctStr.split("|");
  const isCorrect = answers.includes(val);

  if (!isTestMode) {
    if (isCorrect) input.classList.add("correct");
    else input.classList.add("wrong");
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

  allBtns.forEach((b) => {
    b.classList.remove(
      "selected-correct",
      "selected-wrong",
      "selected-neutral",
    );
    if (!isTestMode) b.disabled = true;
  });

  if (isTestMode) {
    btn.classList.add("selected-neutral");
  } else {
    if (isCorrect) btn.classList.add("selected-correct");
    else btn.classList.add("selected-wrong");
  }

  saveState(uid, {
    val: btn.dataset.val,
    idx: btn.dataset.idx,
    isCorrect,
    type: "option",
  });
  if (!isTestMode) recalcStats();
}

function saveState(uid, data) {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state[uid] = data;
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
            input.disabled = true;
            if (saved.isCorrect) input.classList.add("correct");
            else input.classList.add("wrong");
            const b = row.querySelector(".btn-check");
            if (b) b.disabled = true;
          }
        }
      } else if (saved.type === "option") {
        const btns = row.querySelectorAll(".option-btn");
        btns.forEach((b) => {
          if (!isTestMode) b.disabled = true;
          if (
            (saved.idx !== undefined && b.dataset.idx == saved.idx) ||
            b.dataset.val === saved.val
          ) {
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
  if (isTestMode) return;
  totalCorrect = document.querySelectorAll(
    ".correct, .selected-correct",
  ).length;
  totalWrong = document.querySelectorAll(".wrong, .selected-wrong").length;
  const c = document.getElementById("val-correct");
  if (c) c.innerText = totalCorrect;
  const w = document.getElementById("val-wrong");
  if (w) w.innerText = totalWrong;
}

function finishLesson() {
  const maxScore = currentLessonConfig.maxScore || 12;

  if (isTestMode) {
    if (!confirm("Здати тест? Змінити відповіді буде неможливо.")) return;

    document.body.classList.add("checked");
    revealTestResults(); // Фарбуємо інпути

    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    totalCorrect = 0;
    totalWrong = 0;
    Object.values(state).forEach((s) => {
      if (s.isCorrect) totalCorrect++;
      else totalWrong++;
    });

    document.querySelectorAll("input, button").forEach((el) => {
      if (!el.closest(".modal-content")) el.disabled = true;
    });

    const btnF = document.querySelector(".btn-finish");
    if (btnF) btnF.style.display = "none";
  } else {
    recalcStats();
  }

  const percent = Math.round(
    (totalCorrect / (totalCorrect + totalWrong || 1)) * 100,
  );
  showModal(percent, totalCorrect, totalWrong);
}

function revealTestResults() {
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  Object.keys(state).forEach((uid) => {
    const item = state[uid];
    const row = document.querySelector(`.task-row[data-uid="${uid}"]`);
    if (!row) return;

    if (item.type === "input") {
      const input = row.querySelector("input");
      if (input) {
        if (item.isCorrect) input.classList.add("correct");
        else input.classList.add("wrong");
      }
    } else if (item.type === "option") {
      const btns = row.querySelectorAll(".option-btn");
      btns.forEach((b) => {
        b.classList.remove("selected-neutral");
        if (
          (item.idx !== undefined && b.dataset.idx == item.idx) ||
          b.dataset.val === item.val
        ) {
          if (item.isCorrect) b.classList.add("selected-correct");
          else b.classList.add("selected-wrong");
        }
      });
    }
  });
}

function showModal(percent, correct, wrong) {
  const title = isTestMode ? "Тест завершено" : "Результат";
  const scoreColor = percent >= 50 ? "#10b981" : "#ef4444";
  const btnColor = isTestMode
    ? "#ea580c"
    : document.body.classList.contains("mode-homework")
      ? "#8b5cf6"
      : "#4f46e5";

  const modalHTML = `
      <div id="resultModal" class="modal-overlay" style="display: flex;">
        <div class="modal-content">
          <div class="modal-score-circle" style="border-color: ${scoreColor}; color: ${scoreColor}">
            ${percent}%
          </div>
          <h2 class="modal-title">${title}</h2>
          <p class="modal-text">
            ✅ Правильно: <b>${correct}</b> <br> 
            ❌ Помилок: <b>${wrong}</b>
          </p>
          <div class="modal-actions">
            <button class="btn-primary" onclick="location.reload()" 
                    style="background-color: ${btnColor}; color: white;">
              🔄 ${isTestMode ? "Перездати" : "Спробувати ще"}
            </button>
            <button class="btn-secondary" onclick="window.history.back()"
                    style="background: transparent; border: 2px solid #e2e8f0; color: #64748b;">
              ⬅ Назад в меню
            </button>
            <button class="btn-secondary" onclick="document.getElementById('resultModal').remove()"
                    style="background: #f1f5f9; border: none; color: #475569;">
              Закрити
            </button>
          </div>
        </div>
      </div>
    `;
  const old = document.getElementById("resultModal");
  if (old) old.remove();
  document.body.insertAdjacentHTML("beforeend", modalHTML);
}
