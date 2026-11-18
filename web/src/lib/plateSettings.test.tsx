import { afterEach, describe, expect, it } from "vitest";
import { defaultPlateSettings, loadPlateSettings, savePlateSettings } from "./plateSettings";

afterEach(() => localStorage.clear());

describe("plate settings", () => {
  it("starts with a 45 lb bar and standard plates (55 lb optional)", () => {
    expect(loadPlateSettings("alice", "lb")).toEqual(defaultPlateSettings("lb"));
    expect(loadPlateSettings("alice", "lb").availablePlates).not.toContain(55);
  });

  it("saves a selected 55 lb plate and a custom bar weight", () => {
    const settings = { barWeight: 35, availablePlates: [55, 45, 10] };
    expect(savePlateSettings("alice", "lb", settings)).toBe(true);
    expect(loadPlateSettings("alice", "lb")).toEqual(settings);
  });

  it("keeps settings separate by user and unit", () => {
    savePlateSettings("alice", "lb", { barWeight: 35, availablePlates: [55] });
    expect(loadPlateSettings("bob", "lb")).toEqual(defaultPlateSettings("lb"));
    expect(loadPlateSettings("alice", "kg")).toEqual(defaultPlateSettings("kg"));
  });

  it("falls back safely when stored settings are invalid", () => {
    localStorage.setItem("spotter:plates:v1:alice:lb", "not json");
    expect(loadPlateSettings("alice", "lb")).toEqual(defaultPlateSettings("lb"));
    localStorage.setItem("spotter:plates:v1:alice:lb", '{"barWeight":-4,"availablePlates":[700]}');
    expect(loadPlateSettings("alice", "lb")).toEqual(defaultPlateSettings("lb"));
  });
});
