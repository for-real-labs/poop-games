import { expect, it } from "vitest";
import { boardGeometry, cellTypography } from "../src/layout";

it.each([
  [320, 210, 9],
  [375, 260, 15],
  [390, 370, 15],
  [440, 417, 15],
  [700, 810, 15],
  [700, 500, 9],
])("fits the largest whole cells in a %i × %i play area for a %i-square grid", (width, height, size) => {
  const { cellSize, boardWidth } = boardGeometry(width, height, size);
  const limit = Math.min(width - 16, height - 8, 660);
  expect(Number.isInteger(cellSize)).toBe(true);
  expect(boardWidth).toBe(cellSize * size);
  expect(boardWidth).toBeLessThanOrEqual(limit);
  expect(boardWidth + size).toBeGreaterThan(limit);
  const type = cellTypography(cellSize);
  expect(type.numberSize).toBeGreaterThanOrEqual(6);
  expect(type.letterSize).toBeGreaterThanOrEqual(8);
  expect(type.letterLineHeight + type.letterTop).toBeLessThanOrEqual(cellSize - 1);
});

it("waits for usable layout space before drawing a grid", () => {
  expect(boardGeometry(390, 0, 15)).toEqual({ cellSize: 0, boardWidth: 0 });
});
