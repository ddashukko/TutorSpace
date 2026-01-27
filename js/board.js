const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const boardSection = document.getElementById("board-section");
let painting = false;
let tool = "pen";

// --- Логіка малювання ---
function resizeCanvas() {
  const temp = document.createElement("canvas");
  const tempCtx = temp.getContext("2d");
  temp.width = canvas.width;
  temp.height = canvas.height;
  if (canvas.width > 0 && canvas.height > 0) tempCtx.drawImage(canvas, 0, 0);

  canvas.width = boardSection.offsetWidth;
  canvas.height = boardSection.offsetHeight;
  ctx.drawImage(temp, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", resizeCanvas);

function startPosition(e) {
  painting = true;
  draw(e);
}
function finishedPosition() {
  painting = false;
  ctx.beginPath();
}

function draw(e) {
  if (!painting) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

  if (tool === "pen") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2563eb";
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.lineWidth = 25;
    ctx.strokeStyle = "#ffffff";
    ctx.globalCompositeOperation = "destination-out";
  }

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

canvas.addEventListener("mousedown", startPosition);
canvas.addEventListener("mouseup", finishedPosition);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("touchstart", startPosition);
canvas.addEventListener("touchend", finishedPosition);
canvas.addEventListener("touchmove", draw);

function setTool(t) {
  tool = t;
  document
    .querySelectorAll(".btn-tool")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById(`t-${t}`);
  if (btn) btn.classList.add("active");
}

function clearCanvasSafe() {
  if (confirm("Очистити дошку?"))
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawSystem() {
  // Тут буде код малювання системи
  alert("Координатна пряма (заготовка)");
}

// --- Логіка кнопки приховування (FIXED) ---
document.addEventListener("DOMContentLoaded", () => {
  // Ініціалізація дошки
  resizeCanvas();

  // Логіка кнопки
  const toggleBtn = document.getElementById("toggle-board-btn");

  if (!toggleBtn) return; // Якщо кнопки немає на сторінці, виходимо

  toggleBtn.addEventListener("click", () => {
    // 1. Перемикаємо клас на body
    document.body.classList.toggle("board-hidden");

    // 2. Перевіряємо стан
    const isHidden = document.body.classList.contains("board-hidden");

    // 3. Змінюємо вигляд кнопки
    toggleBtn.classList.toggle("active", !isHidden);
    const span = toggleBtn.querySelector("span");
    if (span) {
      span.innerText = isHidden ? "Показати дошку" : "Дошка";
    }

    // 4. Якщо дошку відкрили, треба оновити Canvas, бо його розмір змінився
    if (!isHidden) {
      setTimeout(() => {
        resizeCanvas();
      }, 450); // Чекаємо завершення анімації (0.4s) + запас
    }
  });
});
