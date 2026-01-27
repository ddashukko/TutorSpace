// Твоє посилання на скрипт (те саме, що було)
const API_URL =
  "https://script.google.com/macros/s/AKfycbyElAtTgy9sd2iHhYoQAei4mfRPMPk8lfUeK37wAOZtP2-BpJTifwNJ3RB9UrH2iGbP/exec";

// СПИСОК УРОКІВ
// id: унікальний код (англ літери)
// title: назва для учня
// file: шлях до файлу
// maxScore: скільки всього балів
const LESSONS = [
  {
    id: "alg8_14_roots",
    title: "Алгебра 8. Арифметичний квадратний корінь",
    file: "lessons/14-arithmetic-square-root.html",
    class: "8",
    maxScore: 12, // Зміни на реальну кількість балів у цьому уроці
  },
  {
    id: "alg8_15_sets",
    title: "Алгебра 8. Числові множини",
    file: "lessons/15-number-sets.html",
    class: "8",
    maxScore: 12,
  },
  {
    id: "alg8_16_identity",
    title: "Алгебра 8. Тотожність кореня та рівняння",
    file: "lessons/16-root-identity-and-equations.html",
    class: "8",
    maxScore: 12,
  },
  {
    id: "alg8_17_properties",
    title: "Алгебра 8. Властивості арифметичного кореня",
    file: "lessons/17-arithmetic-square-root-properties.html",
    class: "8",
    maxScore: 12,
  },
  {
    id: "math_7_intensive_calc",
    title: "Інтенсив: Множення та Ділення (Стовпчик)",
    file: "lessons/multiplication-division.html",
    class: "7",
    maxScore: 12,
  },
  // Сюди додаєш нові уроки через кому
];
