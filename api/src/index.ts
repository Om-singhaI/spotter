import { z } from "zod";
import { app } from "./app.js";

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
  })
  .parse(process.env);

app.listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
});
