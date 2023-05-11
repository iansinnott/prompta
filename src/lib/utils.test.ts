import { describe, it, expect } from "vitest";

import { chunk } from "./utils";

describe("chunk test", () => {
  const tt = [
    {
      xs: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      size: 3,
      expected: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    },
    {
      xs: [1, 2, 3, 4, 5, 6, 7, 8],
      size: 3,
      expected: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ],
    },
    {
      xs: [5, 6, 7, 8],
      size: 30,
      expected: [[5, 6, 7, 8]],
    },
  ];

  for (const t of tt) {
    it(`should chunk an array`, () => {
      expect(chunk(t.xs, t.size)).toEqual(t.expected);
    });
  }
});
