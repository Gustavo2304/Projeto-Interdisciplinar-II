# Banco de dados — HermesPDV (Aula 5)

Banco relacional em **PostgreSQL** (testado na versão 16; funciona a partir da 14).

| Arquivo | Conteúdo |
|---|---|
| `script_criacao.sql` | Cria o banco `hermespdv`, as 9 tabelas, chaves, índices e restrições |
| `script_carga.sql` | Dados de teste fictícios (84 vendas de outubro/2026, 30 produtos, 12 clientes...) |
| `consultas.sql` | 12 consultas comentadas para os relatórios do sistema |
| `dicionario_dados.md` | Dicionário de dados completo |
| `diagramas/` | DER (modelo conceitual) e modelo lógico, em PNG e SVG |
| `prints/` | Resultados das consultas, execução dos scripts e demonstração do CRUD (prints e vídeo) |

## Como executar

No terminal, dentro desta pasta:

```bash
psql -U postgres -f script_criacao.sql                 # cria (ou recria) o banco
psql -U postgres -d hermespdv -f script_carga.sql      # carrega os dados de teste
psql -U postgres -d hermespdv -f consultas.sql         # roda as consultas
```

No **pgAdmin**: execute a PARTE 1 de `script_criacao.sql` conectado ao banco `postgres`;
depois abra o Query Tool no banco `hermespdv` e execute a PARTE 2 e os outros arquivos.

Os dois scripts podem ser executados de novo: a criação apaga e recria o banco,
e a carga limpa as tabelas antes de inserir.

## Dados de teste

Todos os dados são **fictícios**: nomes inventados, CPFs e CNPJs gerados aleatoriamente
(com dígito verificador válido) e e-mails no domínio reservado `example.com`.

Usuários de teste (senha de todos: `Hermes@2026`, gravada como hash bcrypt):

| Login | Perfil |
|---|---|
| helena.adm | ADMINISTRADOR |
| rafael.gerente | GERENTE |
| bianca.caixa, diego.caixa, larissa.caixa | ATENDENTE |
| otavio.caixa | ATENDENTE (inativo) |

## Convenções

Nomes em minúsculo, sem acento, com underscore e no singular. Chave primária `id_<tabela>`;
chave estrangeira com o mesmo nome da chave referenciada. Restrições com prefixo
`pk_`, `fk_`, `uq_`, `ck_` e índices com `idx_`.
