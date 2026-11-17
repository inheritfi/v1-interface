import { describe, expect, it } from "vitest";
import { contactLinkHash, entrySection, ownerFromHash, ownerLinkHash, sectionFromHash } from "./section";

const OWNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("sectionFromHash", () => {
  it("#wrap, #plan, #heir and the #owner/… links; anything else is not a section", () => {
    expect(sectionFromHash("#wrap")).toBe("wrap");
    expect(sectionFromHash("#plan")).toBe("plan");
    expect(sectionFromHash("#heir")).toBe("heir");
    expect(sectionFromHash(`#owner/${OWNER}`)).toBe("heir");
    expect(sectionFromHash("#owner/garbage")).toBe("heir");
    for (const h of ["", "#", "#WRAP", "#Plan", "#wrap/", "#wrapx", " #wrap", "#heirs", "#plan?x", "#owner", "#contacts", "#Contact"]) expect(sectionFromHash(h)).toBeNull();
  });

  it("#contact and #contact/… are the contact view", () => {
    expect(sectionFromHash("#contact")).toBe("contact");
    expect(sectionFromHash(`#contact/${OWNER}`)).toBe("contact");
    expect(sectionFromHash("#contact/garbage")).toBe("contact");
  });
});

describe("ownerFromHash", () => {
  it("returns the address with checksum; accepts lowercase; rejects wrong checksum, zero and bad formats", () => {
    expect(ownerFromHash(`#owner/${OWNER}`)).toBe(OWNER);
    expect(ownerFromHash(`#owner/${OWNER.toLowerCase()}`)).toBe(OWNER);
    expect(ownerFromHash(ownerLinkHash(OWNER))).toBe(OWNER);
    expect(ownerFromHash(`#owner/${OWNER.replace("C51", "c51")}`)).toBe("invalid");
    expect(ownerFromHash("#owner/0x0000000000000000000000000000000000000000")).toBe("invalid");
    expect(ownerFromHash("#owner/0x123")).toBe("invalid");
    expect(ownerFromHash(`#owner/${OWNER}/x`)).toBe("invalid");
    expect(ownerFromHash("#heir")).toBeNull();
    expect(ownerFromHash("#contact")).toBeNull();
    expect(ownerFromHash(contactLinkHash(OWNER))).toBe(OWNER);
    expect(ownerFromHash(`#contact/${OWNER.toLowerCase()}`)).toBe(OWNER);
    expect(ownerFromHash("#contact/0x123")).toBe("invalid");
    expect(ownerFromHash("#plan")).toBeNull();
  });
});

describe("entrySection", () => {
  const none = { balance: 0n, hasPlan: false };
  it("without iTokens or a plan in any asset → wrap", () => {
    expect(entrySection([none, none, none])).toBe("wrap");
    expect(entrySection([])).toBe("wrap");
  });
  it("with some iToken or some plan → the plan", () => {
    expect(entrySection([none, { balance: 1n, hasPlan: false }])).toBe("plan");
    expect(entrySection([{ balance: 0n, hasPlan: true }, none])).toBe("plan");
  });
});
