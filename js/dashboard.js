/* --- js/dashboard.js --- */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Перевіряємо, чи є ім'я в пам'яті
  const user = localStorage.getItem("studentName");

  if (!user) {
    // Якщо немає - показуємо вікно входу
    document.getElementById("loginModal").style.display = "flex";
  } else {
    // Якщо є - запускаємо дашборд
    document.getElementById("loginModal").style.display = "none";
    initDashboard(user);
  }
});

function login() {
  const name = document.getElementById("username").value.trim();
  if (name.length > 1) {
    localStorage.setItem("studentName", name);
    document.getElementById("loginModal").style.display = "none";
    initDashboard(name);
  } else {
    alert("Введіть ім'я!");
  }
}

function logout() {
  localStorage.removeItem("studentName");
  location.reload();
}

async function initDashboard(user) {
  document.getElementById("welcomeName").innerText = user;
  const grid = document.getElementById("lessonGrid");

  // Перевірка на наявність уроків
  if (typeof LESSONS === "undefined" || LESSONS.length === 0) {
    grid.innerHTML =
      "<p style='color:var(--text-muted)'>Уроків поки немає...</p>";
    return;
  }

  // 1. Спочатку малюємо картки (швидко)
  grid.innerHTML = LESSONS.map(
    (lesson) => `
    <a href="${lesson.file}" class="lesson-card" id="card-${lesson.id}">
        <div class="card-top">
            <span class="lesson-badge">${lesson.class} Клас</span>
            <h3 class="lesson-title">${lesson.title}</h3>
            <div class="lesson-info">Макс. балів: ${lesson.maxScore}</div>
        </div>
        
        <div class="card-bottom">
            <div class="progress-bg">
                <div id="bar-${lesson.id}" class="progress-bar"></div>
            </div>
            <span id="badge-${lesson.id}" class="status-text">Не розпочато</span>
        </div>
    </a>
  `,
  ).join("");

  // 2. Додаємо ЛОАДЕР (Індикатор завантаження)
  // Вставляємо його ПЕРЕД сіткою карток
  const loaderHTML = `
    <div id="data-loader" class="loader-container">
        <div class="spinner"></div>
        <span>Синхронізація твоїх успіхів...</span>
    </div>
  `;
  grid.insertAdjacentHTML("beforebegin", loaderHTML);

  // 3. Підтягуємо дані з Гугла
  if (typeof API_URL !== "undefined" && API_URL) {
    try {
      const response = await fetch(
        `${API_URL}?studentName=${encodeURIComponent(user)}`,
      );
      const data = await response.json();

      // Оновлюємо кожну картку реальними даними
      LESSONS.forEach((lesson) => {
        const attempts = data.filter((d) => d.lessonId === lesson.id);

        if (attempts.length > 0) {
          const last = attempts[attempts.length - 1];
          const percent = Math.round((last.score / lesson.maxScore) * 100);

          const badge = document.getElementById(`badge-${lesson.id}`);
          const bar = document.getElementById(`bar-${lesson.id}`);

          if (badge && bar) {
            badge.innerText = `Результат: ${last.score}/${lesson.maxScore} (${percent}%)`;
            bar.style.width = `${percent}%`;

            if (percent >= 90) {
              bar.style.backgroundColor = "#10b981";
            }
          }
        }
      });
    } catch (e) {
      console.error("Помилка завантаження даних", e);
    } finally {
      // 4. ЦЕ ГОЛОВНЕ: Видаляємо лоадер, коли все готово (або є помилка)
      const loader = document.getElementById("data-loader");
      if (loader) loader.remove();
    }
  } else {
    // Якщо API немає, теж прибираємо лоадер
    const loader = document.getElementById("data-loader");
    if (loader) loader.remove();
  }
}
