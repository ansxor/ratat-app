import { migrate } from "drizzle-orm/bun-sql/migrator";
import { db, sql } from "./client.ts";

await migrate(db, { migrationsFolder: "./drizzle" });
await sql.close();
process.stdout.write("Migrations applied\n");
