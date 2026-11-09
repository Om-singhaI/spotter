import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import type { Unit } from "../lib/units";
import {
  defaultPlateSettings,
  loadPlateSettings,
  PLATE_OPTIONS,
  savePlateSettings,
  type PlateSettings,
} from "../lib/plateSettings";

type Me = {
  id: string;
  display_name: string;
  weight_unit: Unit;
  share_numbers: boolean;
  email: string | null;
};

function PlateSettingsSection({ userId, unit }: { userId: string; unit: Unit }) {
  const [settings, setSettings] = useState<PlateSettings>(() => loadPlateSettings(userId, unit));
  const [barWeightDraft, setBarWeightDraft] = useState(String(settings.barWeight));
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!savePlateSettings(userId, unit, settings));
  }, [userId, unit, settings]);

  function changeBarWeight(value: string) {
    setBarWeightDraft(value);
    const parsed = Number(value);
    if (value.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
      setSettings((current) => ({ ...current, barWeight: parsed }));
    }
  }

  function togglePlate(plate: number) {
    setSettings((current) => {
      const present = current.availablePlates.includes(plate);
      if (present && current.availablePlates.length === 1) return current;
      const availablePlates = present
        ? current.availablePlates.filter((p) => p !== plate)
        : PLATE_OPTIONS[unit].filter((p) => p === plate || current.availablePlates.includes(p));
      return { ...current, availablePlates };
    });
  }

  function reset() {
    const defaults = defaultPlateSettings(unit);
    setSettings(defaults);
    setBarWeightDraft(String(defaults.barWeight));
  }

  return (
    <section className="mb-6 rounded-2xl bg-zinc-900 p-4" aria-labelledby="plate-settings-title">
      <h2 id="plate-settings-title" className="mb-1 text-lg font-bold">
        Plate settings
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        Choose the plates available at your gym. The barbell preview will use these settings for
        barbell exercises.
      </p>

      <label className="mb-4 block text-sm text-zinc-300">
        Bar weight ({unit})
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="any"
          value={barWeightDraft}
          onChange={(event) => changeBarWeight(event.target.value)}
          onBlur={() => setBarWeightDraft(String(settings.barWeight))}
          className="mt-1 block min-h-11 w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-zinc-100"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-zinc-300">
          Available plates ({unit})
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATE_OPTIONS[unit].map((plate) => (
            <label
              key={plate}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-800 px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={settings.availablePlates.includes(plate)}
                disabled={
                  settings.availablePlates.length === 1 && settings.availablePlates.includes(plate)
                }
                onChange={() => togglePlate(plate)}
                className="accent-red-600"
              />
              {plate} {unit}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          {saveFailed ? "Could not save settings in this browser." : "Saved on this device only."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold"
        >
          Reset defaults
        </button>
      </div>
    </section>
  );
}

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    apiGet<Me>("/me")
      .then(setMe)
      .catch(() => setError(true));
  }, []);

  async function changeUnit(unit: Unit) {
    if (!me || savingUnit || me.weight_unit === unit) return;
    setSavingUnit(true);
    setUnitError(false);
    try {
      const profile = await apiPatch<Me>("/me", { weight_unit: unit });
      setMe(profile);
    } catch {
      setUnitError(true);
    } finally {
      setSavingUnit(false);
    }
  }

  async function logOut() {
    // The route guard sends us home once the session is gone.
    await signOut();
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Your account</h1>
        <Link to="/" className="text-sm text-zinc-400">
          Home
        </Link>
      </header>
      {error && <p className="text-red-400">Could not load your profile.</p>}
      {me && (
        <>
          <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-semibold">{me.display_name}</dd>
            <dt className="text-zinc-500">Email</dt>
            <dd>{me.email}</dd>
            <dt className="self-center text-zinc-500">Units</dt>
            <dd>
              <select
                aria-label="Weight units"
                value={me.weight_unit}
                disabled={savingUnit}
                onChange={(event) => void changeUnit(event.target.value as Unit)}
                className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 disabled:opacity-60"
              >
                <option value="lb">Pounds (lb)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
              {unitError && (
                <p role="alert" className="mt-1 text-red-400">
                  Could not update units. Please try again.
                </p>
              )}
            </dd>
          </dl>
          <PlateSettingsSection
            key={`${me.id}:${me.weight_unit}`}
            userId={me.id}
            unit={me.weight_unit}
          />
        </>
      )}
      <button
        type="button"
        onClick={logOut}
        className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-semibold"
      >
        Log out
      </button>
    </main>
  );
}
