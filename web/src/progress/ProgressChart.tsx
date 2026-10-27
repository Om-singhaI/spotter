import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fromKg, type Unit } from "../lib/units";
import type { ProgressPoint } from "./types";

type Props = { points: ProgressPoint[]; unit: Unit };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// Best estimated one rep max and top set per session, in the user's unit. The table
// under the chart is the text alternative, so the SVG itself is presented as an image.
export default function ProgressChart({ points, unit }: Props) {
  const data = points.map((p) => ({
    date: shortDate(p.started_at),
    estimate: fromKg(p.best_e1rm_kg, unit),
    top: fromKg(p.top_weight_kg, unit),
  }));
  return (
    <div
      className="h-60 w-full"
      role="img"
      aria-label="Estimated one rep max and top set weight over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          accessibilityLayer={false}
        >
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value) => `${value} ${unit}`}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Line
            name="Est. 1RM"
            type="monotone"
            dataKey="estimate"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            name="Top set"
            type="monotone"
            dataKey="top"
            stroke="#a1a1aa"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
