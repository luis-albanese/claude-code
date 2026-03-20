-- Smartway × Claude Code — Supabase Setup
-- Ejecutar en el SQL Editor de tu proyecto de Supabase

CREATE TABLE IF NOT EXISTS usage_reports (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      text        NOT NULL,
  developer_name  text        NOT NULL,
  project_name    text        NOT NULL,
  project_path    text        NOT NULL,
  report_type     text        NOT NULL CHECK (report_type IN ('start', 'heartbeat', 'stop')),
  session_summary text,       -- resumen de cambios al cerrar (solo en report_type = 'stop')
  created_at      timestamptz DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_usage_reports_session    ON usage_reports (session_id);
CREATE INDEX IF NOT EXISTS idx_usage_reports_developer  ON usage_reports (developer_name);
CREATE INDEX IF NOT EXISTS idx_usage_reports_project    ON usage_reports (project_name);
CREATE INDEX IF NOT EXISTS idx_usage_reports_created_at ON usage_reports (created_at DESC);

-- Row Level Security
ALTER TABLE usage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir insert desde service role"
  ON usage_reports FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Permitir select desde service role"
  ON usage_reports FOR SELECT TO service_role USING (true);

-- ─── Si ya existe la tabla y solo necesitás agregar la columna nueva ───────────
-- ALTER TABLE usage_reports ADD COLUMN IF NOT EXISTS session_summary text;

-- Vista de actividad por desarrollador y proyecto
CREATE OR REPLACE VIEW v_dev_activity AS
SELECT
  developer_name,
  project_name,
  COUNT(*)           FILTER (WHERE report_type = 'start')     AS total_sessions,
  COUNT(*)           FILTER (WHERE report_type = 'heartbeat') AS total_heartbeats,
  MIN(created_at)                                              AS primera_sesion,
  MAX(created_at)                                              AS ultima_actividad
FROM usage_reports
GROUP BY developer_name, project_name
ORDER BY ultima_actividad DESC;

-- Vista de sesiones con resumen (útil para ver qué hizo cada dev)
CREATE OR REPLACE VIEW v_session_summaries AS
SELECT
  s.session_id,
  s.developer_name,
  s.project_name,
  st.created_at  AS inicio,
  s.created_at   AS fin,
  EXTRACT(EPOCH FROM (s.created_at - st.created_at)) / 60 AS duracion_minutos,
  s.session_summary
FROM usage_reports s
JOIN usage_reports st
  ON st.session_id = s.session_id AND st.report_type = 'start'
WHERE s.report_type = 'stop'
ORDER BY s.created_at DESC;
