# HermesPDV

Sistema de Ponto de Venda (PDV) com banco de dados para registrar vendas, produtos, formas de pagamento e controle de estoque.
Projeto da disciplina **Projeto Interdisciplinar II** (Prof. Rafael Gross).

## Funcionalidades previstas
- Login com perfis de acesso (Atendente, Gerente e Administrador)
- Cadastro de produtos, categorias, clientes e usuários
- Registro de venda com carrinho, desconto e pagamento dividido
- Baixa automática de estoque e alerta de estoque baixo
- Consulta e cancelamento de vendas, comprovante e relatórios

## Tecnologias (proposta, a confirmar com a equipe)
| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS, JavaScript e Bootstrap 5 |
| Back-end | Node.js + Express (API REST) |
| Banco de dados | PostgreSQL |
| Segurança | bcrypt (hash de senha) e JWT |

## Estrutura do repositório
```
backend/    API: routes, controllers, services, repositories, models, middlewares
frontend/   telas (pages), estilos (css) e scripts (js)
database/   schema e dados de teste (Aula 5)
docs/       requisitos, processos, UML, arquitetura e protótipo
```

## Documentação
- Casos de uso, classes e sequência: `docs/uml/`
- Arquitetura: `docs/arquitetura/`
- Protótipo (wireframes e navegação): `docs/prototipo/`

## Equipe
| Integrante | Papel | GitHub |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

## Convenção de trabalho
- `main`: versão estável. Trabalho em branches `feature/<nome-da-funcionalidade>`.
- Mensagens de commit curtas e no imperativo (ex.: `Adiciona cadastro de produto`).
- Todo integrante deve ter commits próprios.
- Integração por pull request com revisão de outro integrante.
