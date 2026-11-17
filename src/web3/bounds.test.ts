import { getAddress, zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import {
  BP,
  MAX_TAX,
  PERIOD_BOUNDS,
  checkContacts,
  checkHeirs,
  checkMaxHeirs,
  checkMaxRecoveryUsers,
  checkPeriod,
  checkPeriodRelations,
  checkTax,
  checkTreasuries,
  type PeriodName,
} from "./bounds";

const DAY = 86_400n;
const OWNER: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const CONTRACT: Address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const addr = (n: number): Address => getAddress(`0x${n.toString(16).padStart(40, "0")}`);
const many = (n: number): Address[] => Array.from({ length: n }, (_, i) => addr(i + 1));
const REJECT = /Value contradicts the deployed contracts/;

describe("rules of the frozen code of the contracts (bounds.ts)", () => {
  it("values of the contract constants", () => {
    expect(BP).toBe(10_000n);
    expect(MAX_TAX).toBe(30n);
    expect(PERIOD_BOUNDS).toEqual({
      recoveryInactivityPeriod: { min: 14n * DAY, max: 180n * DAY },
      inheritInactivityPeriod: { min: 21n * DAY, max: 180n * DAY },
      inheritWaitingTime: { min: 3n * DAY, max: 90n * DAY },
      inheritRemainingWaitingTime: { min: 3n * DAY, max: 90n * DAY },
      recoveryWaitingTime: { min: 2n * DAY, max: 90n * DAY },
      recoveryExecutionWindow: { min: 7n * DAY, max: 90n * DAY },
    });
  });

  it("fees: from 0 to 30, 31 is rejected", () => {
    expect(checkTax("wrappingTax", 0n)).toBe(0n);
    expect(checkTax("wrappingTax", 30n)).toBe(30n);
    expect(() => checkTax("wrappingTax", 31n)).toThrow(REJECT);
    expect(() => checkTax("unwrappingTax", 10_000n)).toThrow(REJECT);
  });

  it("periods: the minimum and the maximum are accepted; one second less or more is rejected", () => {
    for (const [name, b] of Object.entries(PERIOD_BOUNDS) as [PeriodName, { min: bigint; max: bigint }][]) {
      expect(checkPeriod(name, b.min)).toBe(b.min);
      expect(checkPeriod(name, b.max)).toBe(b.max);
      expect(() => checkPeriod(name, b.min - 1n)).toThrow(REJECT);
      expect(() => checkPeriod(name, b.max + 1n)).toThrow(REJECT);
    }
  });

  it("relations between periods: recovery inactivity lower than the inheritance one; wait + 3 days <= window", () => {
    expect(() => {
      checkPeriodRelations({ recoveryInactivityPeriod: 30n * DAY, inheritInactivityPeriod: 45n * DAY });
    }).not.toThrow();
    expect(() => {
      checkPeriodRelations({ recoveryInactivityPeriod: 45n * DAY, inheritInactivityPeriod: 45n * DAY });
    }).toThrow(REJECT);
    expect(() => {
      checkPeriodRelations({ recoveryWaitingTime: 7n * DAY, recoveryExecutionWindow: 10n * DAY });
    }).not.toThrow();
    expect(() => {
      checkPeriodRelations({ recoveryWaitingTime: 7n * DAY, recoveryExecutionWindow: 10n * DAY - 1n });
    }).toThrow(REJECT);
    // With only one of each pair there is no relation to check.
    expect(() => {
      checkPeriodRelations({ inheritInactivityPeriod: 21n * DAY, recoveryExecutionWindow: 7n * DAY });
    }).not.toThrow();
  });

  it("caps: maxHeirs from 1 to 40 and maxRecoveryUsers from 1 to 50", () => {
    expect(checkMaxHeirs(1n)).toBe(1n);
    expect(checkMaxHeirs(40n)).toBe(40n);
    expect(() => checkMaxHeirs(0n)).toThrow(REJECT);
    expect(() => checkMaxHeirs(41n)).toThrow(REJECT);
    expect(checkMaxRecoveryUsers(50n)).toBe(50n);
    expect(() => checkMaxRecoveryUsers(0n)).toThrow(REJECT);
    expect(() => checkMaxRecoveryUsers(51n)).toThrow(REJECT);
  });

  it("heirs: none or from 1 to 40, valid and distinct addresses, percentages that sum 10 000", () => {
    expect(() => {
      checkHeirs(OWNER, [], []);
    }).not.toThrow();
    expect(() => {
      checkHeirs(OWNER, [addr(1), addr(2)], [6_000n, 4_000n]);
    }).not.toThrow();
    expect(() => {
      checkHeirs(OWNER, many(40), [...Array<bigint>(39).fill(250n), 250n]);
    }).not.toThrow();
    expect(() => {
      checkHeirs(OWNER, many(41), Array<bigint>(41).fill(1n));
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [addr(1)], [9_999n]);
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [addr(1), addr(2)], [10_000n, 0n]);
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [addr(1), addr(1)], [5_000n, 5_000n]);
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [OWNER.toLowerCase() as Address], [10_000n]);
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [zeroAddress], [10_000n]);
    }).toThrow(REJECT);
    expect(() => {
      checkHeirs(OWNER, [addr(1)], []);
    }).toThrow(REJECT);
  });

  it("contacts: none or from 1 to 50, valid and distinct addresses", () => {
    expect(() => {
      checkContacts(OWNER, []);
    }).not.toThrow();
    expect(() => {
      checkContacts(OWNER, many(50));
    }).not.toThrow();
    expect(() => {
      checkContacts(OWNER, many(51));
    }).toThrow(REJECT);
    expect(() => {
      checkContacts(OWNER, [addr(1), addr(1)]);
    }).toThrow(REJECT);
    expect(() => {
      checkContacts(OWNER, [OWNER]);
    }).toThrow(REJECT);
    expect(() => {
      checkContacts(OWNER, [zeroAddress]);
    }).toThrow(REJECT);
  });

  it("treasuries: none or from 1 to 40, different from the contract and from each other, percentages that sum 10 000", () => {
    expect(() => {
      checkTreasuries(CONTRACT, [], []);
    }).not.toThrow();
    expect(() => {
      checkTreasuries(CONTRACT, [addr(1), OWNER], [5_000n, 5_000n]);
    }).not.toThrow();
    expect(() => {
      checkTreasuries(CONTRACT, many(41), Array<bigint>(41).fill(1n));
    }).toThrow(REJECT);
    expect(() => {
      checkTreasuries(CONTRACT, [CONTRACT.toLowerCase() as Address], [10_000n]);
    }).toThrow(REJECT);
    expect(() => {
      checkTreasuries(CONTRACT, [addr(1), addr(1)], [5_000n, 5_000n]);
    }).toThrow(REJECT);
    expect(() => {
      checkTreasuries(CONTRACT, [addr(1), addr(2)], [3_333n, 3_333n]);
    }).toThrow(REJECT);
    expect(() => {
      checkTreasuries(CONTRACT, [zeroAddress], [10_000n]);
    }).toThrow(REJECT);
  });
});
