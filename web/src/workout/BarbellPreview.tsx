import { Link } from "react-router-dom";
import { calculatePlateLoad } from "../lib/plates";
import { PLATE_OPTIONS, type PlateSettings } from "../lib/plateSettings";
import type { Unit } from "../lib/units";

type Props = { weightInput: string; unit: Unit; settings: PlateSettings };

const COLORS: Record<Unit, Record<number, string>> = {
  lb: {
    55: "#d97706",
    45: "#2563eb",
    35: "#eab308",
    25: "#16a34a",
    10: "#a1a1aa",
    5: "#a855f7",
    2.5: "#f97316",
    1.25: "#64748b",
  },
  kg: {
    25: "#dc2626",
    20: "#2563eb",
    15: "#eab308",
    10: "#16a34a",
    5: "#e4e4e7",
    2.5: "#a855f7",
    1.25: "#f97316",
    0.5: "#64748b",
  },
};

const MAX_DRAWN_PER_SIDE = 18;

function Barbell({ perSide, unit }: { perSide: number[]; unit: Unit }) {
  const visible = perSide.slice(0, MAX_DRAWN_PER_SIDE);
  const step = Math.min(13, 156 / Math.max(1, visible.length));
  const plateWidth = step * 0.9;
  const maxPlate = Math.max(...PLATE_OPTIONS[unit]);

  return (
    <>
      <svg
        viewBox="0 0 600 135"
        className="w-full"
        role="img"
        aria-label="Barbell with the same plates loaded on both sides"
      >
        <rect x="16" y="63" width="568" height="9" rx="3" fill="#a1a1aa" />
        <rect x="214" y="58" width="172" height="19" rx="3" fill="#52525b" />
        <rect x="210" y="52" width="7" height="30" rx="2" fill="#d4d4d8" />
        <rect x="383" y="52" width="7" height="30" rx="2" fill="#d4d4d8" />
        {visible.map((weight, index) => {
          const height = 22 + (66 * weight) / maxPlate;
          const leftX = 300 - 90 - (index + 1) * step;
          const rightX = 300 + 90 + index * step;
          const color = COLORS[unit][weight] ?? "#a1a1aa";
          return (
            <g key={`${weight}-${index}`}>
              <rect
                x={leftX}
                y={67.5 - height / 2}
                width={plateWidth}
                height={height}
                rx="2"
                fill={color}
                stroke="#18181b"
                strokeWidth="1"
              />
              <rect
                x={rightX}
                y={67.5 - height / 2}
                width={plateWidth}
                height={height}
                rx="2"
                fill={color}
                stroke="#18181b"
                strokeWidth="1"
              />
            </g>
          );
        })}
        <rect
          x={300 - 90 - visible.length * step - 8}
          y="51"
          width="7"
          height="33"
          rx="2"
          fill="#d4d4d8"
        />
        <rect
          x={300 + 90 + visible.length * step + 1}
          y="51"
          width="7"
          height="33"
          rx="2"
          fill="#d4d4d8"
        />
      </svg>
      {perSide.length > MAX_DRAWN_PER_SIDE && (
        <p className="text-center text-xs text-amber-300">
          Displaying the first {MAX_DRAWN_PER_SIDE} of {perSide.length} plates per side. Full counts
          below.
        </p>
      )}
    </>
  );
}

export default function BarbellPreview({ weightInput, unit, settings }: Props) {
  const entered = weightInput.trim() !== "";
  const weight = Number(weightInput);
  const load = entered ? calculatePlateLoad(weight, settings) : null;
  const perSide = load?.platesPerSide.flatMap(({ weight: plate, count }) =>
    Array.from({ length: Math.min(count, MAX_DRAWN_PER_SIDE + 1) }, () => plate),
  );
  const actualPerSideCount = load?.platesPerSide.reduce((sum, plate) => sum + plate.count, 0) ?? 0;
  const plateList = load?.platesPerSide
    .map(({ weight: plate, count }) => `${plate} ${unit} × ${count}`)
    .join(", ");

  return (
    <section aria-label="Plate calculator" className="mt-3 rounded-xl border border-zinc-800 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Barbell preview</h3>
        <Link to="/account" className="text-xs text-zinc-400 underline underline-offset-2">
          Plate settings
        </Link>
      </div>

      {!entered ? (
        <p className="py-4 text-center text-sm text-zinc-400">Enter a weight to see the plates.</p>
      ) : !load ? (
        <p className="py-4 text-center text-sm text-amber-300">
          {Number.isFinite(weight) && weight < settings.barWeight
            ? `This is lighter than your ${settings.barWeight} ${unit} bar.`
            : "Cannot preview this weight. Check the value or plate settings."}
        </p>
      ) : (
        <>
          <Barbell perSide={perSide ?? []} unit={unit} />
          <p className="text-center text-sm font-semibold">
            {load.loadedWeight} {unit} total · {settings.barWeight} {unit} bar
          </p>
          <p className="mt-1 text-center text-xs text-zinc-400">
            Each side: {actualPerSideCount === 0 ? "No plates" : plateList}
          </p>
          {load.shortfall > 0 && (
            <p role="status" className="mt-2 text-center text-xs text-amber-300">
              Closest load without exceeding target: {load.loadedWeight} {unit} ({load.shortfall}{" "}
              {unit} short).
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-2 border-t border-zinc-800 pt-3">
        {PLATE_OPTIONS[unit]
          .filter((plate) => settings.availablePlates.includes(plate))
          .map((plate) => (
            <span key={plate} className="flex items-center gap-1 text-xs text-zinc-300">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-zinc-600"
                style={{ backgroundColor: COLORS[unit][plate] }}
                aria-hidden="true"
              />
              {plate} {unit}
            </span>
          ))}
      </div>
    </section>
  );
}
