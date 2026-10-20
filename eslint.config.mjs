import { config } from "@remotion/eslint-config-flat";

// src/generated и src/local — личные импорты и сцены, их нет в git. Линтер
// проверяет код шаблона; сгенерированные композиции проверяет check-frames.py.
export default [...config, { ignores: ["src/generated/**", "src/local/**"] }];
