-- Lifetime aggregate counts; per-browser identifiers expire after 365 days.
CREATE TABLE IF NOT EXISTS traffic_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  visits INTEGER NOT NULL DEFAULT 0 CHECK (visits >= 0),
  engaged INTEGER NOT NULL DEFAULT 0 CHECK (engaged >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed >= 0)
);
INSERT OR IGNORE INTO traffic_totals (id) VALUES (1);
CREATE TABLE IF NOT EXISTS traffic_visitors (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  engaged_at INTEGER,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS traffic_visitors_created ON traffic_visitors (created_at);
CREATE TRIGGER IF NOT EXISTS traffic_visit_total AFTER INSERT ON traffic_visitors
BEGIN UPDATE traffic_totals SET visits = visits + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS traffic_engaged_total AFTER UPDATE OF engaged_at ON traffic_visitors
WHEN OLD.engaged_at IS NULL AND NEW.engaged_at IS NOT NULL
BEGIN UPDATE traffic_totals SET engaged = engaged + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS traffic_completed_total AFTER UPDATE OF completed_at ON traffic_visitors
WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
BEGIN UPDATE traffic_totals SET completed = completed + 1 WHERE id = 1; END;
