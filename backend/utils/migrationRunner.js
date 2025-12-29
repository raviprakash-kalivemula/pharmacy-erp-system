const fs = require("fs");
const path = require("path");
const db = require("../config/db");

class MigrationRunner {
  constructor(migrationsPath = "./migrations") {
    this.migrationsPath = migrationsPath;
  }

  async getMigrations() {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith(".sql"))
      .sort();
    return files;
  }

  async getExecutedMigrations() {
    try {
      const [migrations] = await db.query(
        "SELECT migration_name FROM migrations WHERE status = ? ORDER BY batch DESC",
        ["applied"]
      );
      return migrations.map(m => m.migration_name);
    } catch (err) {
      return [];
    }
  }

  async getPendingMigrations() {
    const all = await this.getMigrations();
    const executed = await this.getExecutedMigrations();
    return all.filter(m => !executed.includes(m));
  }

  async runMigration(migrationName) {
    try {
      const filePath = path.join(this.migrationsPath, migrationName);
      const sql = fs.readFileSync(filePath, "utf8");
      const statements = sql.split(";").filter(s => s.trim());

      const startTime = Date.now();
      for (const statement of statements) {
        if (statement.trim()) {
          await db.query(statement);
        }
      }
      const executionTime = Date.now() - startTime;

      const [lastMigration] = await db.query(
        "SELECT MAX(batch) as max_batch FROM migrations"
      );
      const nextBatch = (lastMigration[0]?.max_batch || 0) + 1;

      await db.query(
        "INSERT INTO migrations (migration_name, batch, status, execution_time_ms) VALUES (?, ?, ?, ?)",
        [migrationName, nextBatch, "applied", executionTime]
      );

      return { success: true, executionTime, migrationName };
    } catch (err) {
      await db.query(
        "INSERT INTO migrations (migration_name, batch, status, error_message) VALUES (?, ?, ?, ?)",
        [migrationName, 0, "failed", err.message]
      ).catch(() => {});
      return { success: false, error: err.message, migrationName };
    }
  }

  async runAll() {
    const pending = await this.getPendingMigrations();
    if (pending.length === 0) {
      console.log("[OK] No pending migrations");
      return { total: 0, executed: 0, failed: 0 };
    }

    console.log("\n[INFO] Found " + pending.length + " pending migration(s):\n");
    
    let executed = 0;
    let failed = 0;

    for (const migration of pending) {
      console.log("  Running: " + migration);
      const result = await this.runMigration(migration);
      
      if (result.success) {
        console.log("  [OK] " + migration + " (" + result.executionTime + "ms)\n");
        executed++;
      } else {
        console.log("  [ERROR] " + migration + " - " + result.error + "\n");
        failed++;
      }
    }

    console.log("\n[SUMMARY] Migration Results:");
    console.log("  Total: " + pending.length);
    console.log("  Executed: " + executed);
    console.log("  Failed: " + failed + "\n");

    return { total: pending.length, executed, failed };
  }
}

module.exports = MigrationRunner;
