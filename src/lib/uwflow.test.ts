import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFlowRatings } from "./uwflow";

afterEach(() => vi.unstubAllGlobals());

describe("fetchFlowRatings", () => {
  it("maps UWFlow rows back to catalog codes and marks unknown courses as null", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: {
          course: [
            { code: "ece250", rating: { liked: "0.8055", easy: 0.5365, useful: 0.934, filled_count: 252, comment_count: 49 } },
            { code: "ece499", rating: { liked: null, easy: null, useful: null, filled_count: 0, comment_count: 0 } },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchFlowRatings(["ECE250", "ECE499", "FAKE101"]);

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.variables.codes).toEqual(["ece250", "ece499", "fake101"]);
    expect(out.get("ECE250")).toEqual({ liked: 0.8055, easy: 0.5365, useful: 0.934, filled: 252, comments: 49 });
    expect(out.get("ECE499")).toMatchObject({ liked: null, filled: 0 });
    expect(out.get("FAKE101")).toBeNull();
  });

  it("throws on GraphQL errors", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ errors: [{ message: "bad query" }] }));
    await expect(fetchFlowRatings(["ECE250"])).rejects.toThrow("bad query");
  });
});
