# HermesPDV

Sistema de Ponto de Venda (PDV) com banco de dados para registrar vendas, produtos, formas de pagamento e controle de estoque.
Projeto da disciplina **Projeto Interdisciplinar II** (Prof. Rafael Gross).

## Funcionalidades previstas
- Login com perfis de acesso (Atendente, Gerente e Administrador)
- Cadastro de produtos, categorias, clientes e usuários
- Registro de venda com carrinho, desconto e pagamento dividido
- Baixa automática de estoque e alerta de estoque baixo
- Consulta e cancelamento de vendas, comprovante e relatórios

## Tecnologias
| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS e JavaScript |
| Back-end | Node.js + Express (API REST) |
| Banco de dados | PostgreSQL |
| Segurança | bcrypt (hash de senha) e JWT |

## Estrutura do repositório
```
backend/    API: routes, controllers, services, repositories, models, middlewares
frontend/   telas (pages), estilos (css) e scripts (js)
banco/      scripts SQL, consultas, dicionário e diagramas do banco (Aula 5)
docs/       requisitos, processos, UML, arquitetura e protótipo
```

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org) 20.6 ou superior e [PostgreSQL](https://www.postgresql.org) 14 ou superior.

```bash
# 1. banco de dados
cd banco
psql -U postgres -f script_criacao.sql
psql -U postgres -d hermespdv -f script_carga.sql

# 2. API + telas
cd ../backend
npm install
cp .env.example .env      # no Windows: copy .env.example .env  — depois coloque a senha do PostgreSQL
npm start                 # abra http://localhost:3000
```

Já funciona: cadastro de produtos (listar, buscar, cadastrar, editar, excluir/inativar).

## Documentação
- Casos de uso, classes e sequência: `docs/uml/`
- Arquitetura: `docs/arquitetura/`
- Protótipo (wireframes e navegação): `docs/prototipo/`
- Banco de dados (DER, modelo lógico, dicionário, scripts): `banco/`

## Equipe
| Integrante | Papel |
|---|---|---|
| Gustavo Pinheiro Correia | programador chefe  |
| Gustavo Cena | Front |
| Matheus Alves | Back |

## Convenção de trabalho
- `main`: versão estável. Trabalho em branches `feature/<nome-da-funcionalidade>`.
- Mensagens de commit curtas e no imperativo (ex.: `Adiciona cadastro de produto`).
- Todo integrante deve ter commits próprios.
- Integração por pull request com revisão de outro integrante.
