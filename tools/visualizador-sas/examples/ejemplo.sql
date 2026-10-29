-- Ejemplo sintético. No se ejecuta ni se conecta a una base de datos.
CREATE TABLE analytics.ventas_base AS
SELECT cliente_id, producto_id, monto, fecha
FROM raw.ventas
WHERE fecha >= DATE '2026-01-01';

CREATE VIEW analytics.resumen_clientes AS
WITH clientes_activos AS (
  SELECT cliente_id, segmento
  FROM raw.clientes
  WHERE activo = true
), totales AS (
  SELECT cliente_id, SUM(monto) AS total
  FROM analytics.ventas_base
  GROUP BY cliente_id
)
SELECT c.cliente_id, c.segmento, t.total
FROM clientes_activos c
JOIN totales t ON c.cliente_id = t.cliente_id;

INSERT INTO reporting.ventas_por_segmento
SELECT segmento, SUM(total) AS total_segmento
FROM analytics.resumen_clientes
GROUP BY segmento;

SELECT *
FROM reporting.ventas_por_segmento
ORDER BY total_segmento DESC;

-- Se identifica la operación, pero no se desglosan sus dependencias internas.
DELETE FROM reporting.ventas_por_segmento WHERE total_segmento = 0;
