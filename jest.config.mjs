import { createDefaultEsmPreset } from "ts-jest";

/** @type {import("jest").Config} */
export default {
  ...createDefaultEsmPreset({ tsconfig: "tsconfig.json" }),
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  restoreMocks: true,
};
