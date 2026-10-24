import { describe, expect, it } from "vitest";
import { complexKey } from "./complex";

describe("complexKey", () => {
  it("maps different spellings of a complex to one key", () => {
    expect(complexKey("Brexx at Blacksburg")).toBe("brexx");
    expect(complexKey("BREXX Apartments")).toBe("brexx");
    expect(complexKey("  brexx  ")).toBe("brexx");
  });

  it("drops filler words and phrases", () => {
    expect(complexKey("Hub Blacksburg")).toBe("hub");
    expect(complexKey("Collegiate Suites of Blacksburg")).toBe("collegiate-suites");
    expect(complexKey("Fourteen35 Apartments")).toBe("fourteen35");
    expect(complexKey("Foxridge Apartment Homes")).toBe("foxridge");
    expect(complexKey("The Edge Apartments and Townhomes")).toBe("edge");
    expect(complexKey("Pheasant Run Townhomes, Blacksburg, VA")).toBe("pheasant-run");
  });

  it("drops a trailing site suffix", () => {
    expect(complexKey("Brexx at Blacksburg - Apartments for Rent")).toBe("brexx");
    expect(complexKey("Hub Blacksburg | Student Housing")).toBe("hub");
  });

  it("turns & into and, and keeps numbers", () => {
    expect(complexKey("Smith & Jones")).toBe("smith-and-jones");
    expect(complexKey("203-209 Tee Street")).toBe("203-209-tee-street");
  });

  it("falls back to the plain name when every word is filler", () => {
    expect(complexKey("The Apartments")).toBe("the-apartments");
    expect(complexKey("")).toBe("");
  });
});
