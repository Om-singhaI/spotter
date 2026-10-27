// Gives one account six weeks of believable training history so the ghost row, records,
// and the progress chart have something to show. Intended for the demo account.
//   npm run seed:demo -- demo@example.com          (refuses if the account already has history)
//   npm run seed:demo -- demo@example.com --force  (wipes that account's workouts first)
import { sql } from "../db.js";
import { rebuildRecords } from "../workouts/repo.js";
import { toKg } from "../units.js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("usage: npm run seed:demo -- <email> [--force]");
  process.exit(1);
}

const [user] = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
if (!user) {
  console.error(`no account with email ${email}; sign up in the app first`);
  process.exit(1);
}
await sql`insert into public.profiles (id, display_name) values (${user.id}, ${email.split("@")[0]}) on conflict (id) do nothing`;

const [{ count }] = await sql<{ count: number }[]>`
  select count(*)::int as count from public.workouts where user_id = ${user.id} and finished_at is not null
`;
if (count > 0 && flag !== "--force") {
  console.error(`${email} already has ${count} finished workouts; pass --force to replace them`);
  process.exit(1);
}
if (flag === "--force") {
  await sql`delete from public.workouts where user_id = ${user.id}`;
}

// A three day split over six weeks, with a bit of weekly progress and a bad day or two.
const plan = [
  {
    day: 0,
    lifts: [
      { id: "Barbell_Squat", startLb: 135, stepLb: 5, reps: 5 },
      { id: "Barbell_Bench_Press_-_Medium_Grip", startLb: 95, stepLb: 5, reps: 5 },
    ],
  },
  {
    day: 2,
    lifts: [
      { id: "Barbell_Deadlift", startLb: 185, stepLb: 10, reps: 5 },
      { id: "Bent_Over_Barbell_Row", startLb: 95, stepLb: 5, reps: 8 },
    ],
  },
  {
    day: 4,
    lifts: [
      { id: "Barbell_Squat", startLb: 135, stepLb: 5, reps: 5 },
      { id: "Barbell_Shoulder_Press", startLb: 65, stepLb: 2.5, reps: 5 },
    ],
  },
];
const ids = [...new Set(plan.flatMap((s) => s.lifts.map((l) => l.id)))];
const found = await sql<{ id: string }[]>`select id from public.exercises where id = any(${ids})`;
const missing = ids.filter((id) => !found.some((f) => f.id === id));
if (missing.length > 0) {
  console.error(`missing exercises ${missing.join(", ")}: run npm run seed first`);
  process.exit(1);
}

const weeks = 6;
const start = new Date();
start.setDate(start.getDate() - weeks * 7);
start.setHours(18, 0, 0, 0);

let workouts = 0;
let sets = 0;
// one transaction, so a failure part way leaves no half written history behind
await sql.begin(async (tx) => {
  for (let week = 0; week < weeks; week++) {
    for (const session of plan) {
      const at = new Date(start.getTime() + (week * 7 + session.day) * 86400000);
      if (at > new Date()) continue;
      const finished = new Date(at.getTime() + 55 * 60000);
      const [w] = await tx<{ id: string }[]>`
      insert into public.workouts (user_id, started_at, finished_at) values (${user.id}, ${at}, ${finished}) returning id
    `;
      workouts++;
      let minute = 2;
      for (const lift of session.lifts) {
        const slump = week === 3 ? -1 : 0; // one flat week keeps the chart honest
        const weightLb = lift.startLb + lift.stepLb * Math.max(0, week + slump);
        const reps = lift.reps;
        for (let n = 0; n < 3; n++) {
          const performed = new Date(at.getTime() + minute * 60000);
          minute += 3;
          await tx`
          insert into public.workout_sets (workout_id, user_id, exercise_id, weight_kg, reps, performed_at)
          values (${w.id}, ${user.id}, ${lift.id}, ${toKg(weightLb, "lb")}, ${n === 2 ? reps + 1 : reps}, ${performed})
        `;
          sets++;
        }
      }
    }
  }
});
for (const id of ids) {
  await rebuildRecords(user.id, id);
}
console.log(`seeded ${workouts} workouts and ${sets} sets for ${email}, records rebuilt`);
await sql.end();
