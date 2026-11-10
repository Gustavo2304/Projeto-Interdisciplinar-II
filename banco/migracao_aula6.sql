-- =============================================================================
-- HermesPDV — migracao_aula6.sql
-- Para quem já criou o banco com o script da Aula 5 e não quer recriá-lo.
-- (Quem rodar o script_criacao.sql atual já tem tudo isto.)
--   psql -U postgres -d hermespdv -f migracao_aula6.sql
-- Depois, rode o script_carga.sql de novo para ter os dados de teste atualizados.
-- =============================================================================
SET client_encoding = 'UTF8';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Sao_Paulo');
END $$;

ALTER TABLE venda ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMP;
ALTER TABLE venda DROP CONSTRAINT IF EXISTS ck_venda_inicio;
ALTER TABLE venda ADD CONSTRAINT ck_venda_inicio CHECK (iniciada_em IS NULL OR iniciada_em <= data_hora);
COMMENT ON COLUMN venda.iniciada_em IS 'Quando o atendente começou a venda no PDV (tempo de atendimento = data_hora - iniciada_em)';
