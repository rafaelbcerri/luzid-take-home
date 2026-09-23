# Login na raiz e workspace em `/dashboard`

## Objetivo

Fazer com que a primeira tela do produto seja o login em `/` e mover a home
atual, que contém upload e listagem de scripts, para `/dashboard` como área
interna autenticada.

## Decisões

- `/` será a rota oficial de login para visitantes.
- Usuários autenticados que acessarem `/` serão redirecionados para
  `/dashboard`.
- `/dashboard` será a nova home privada e receberá o conteúdo atual de `/`:
  upload, listagem de scripts e estados de processamento.
- `/recordings/[recordingId]` continuará sendo a página privada de detalhe.
- `/login` continuará existindo apenas como redirecionamento para `/`, para
  preservar links antigos e favoritos.
- As rotas auxiliares de conta permanecerão em `/signup`, `/forgot-password`,
  `/update-password` e `/auth/callback`.
- `/share/[token]` continuará público, sem exigir login.

## Fluxo de navegação

1. Um visitante acessa `/` e vê o formulário de login.
2. Ao acessar `/dashboard` ou `/recordings/[recordingId]` sem sessão, é
   redirecionado para `/?next=...`.
3. Depois do login, o usuário retorna ao caminho interno indicado por `next`;
   sem `next`, vai para `/dashboard`.
4. Um usuário autenticado que acessa `/` vai diretamente para `/dashboard`.
5. O logout encerra a sessão e redireciona para `/`.
6. O acesso a `/login` redireciona para `/`.
7. Rotas públicas de compartilhamento não participam do fluxo de proteção
   privada.

O parâmetro `next` aceitará somente caminhos locais que começam com `/`, não
começam com `//` e não contêm barras invertidas. Valores inválidos cairão no
 destino padrão `/dashboard` após autenticação.

## Arquitetura

A página raiz será responsável por decidir entre exibir o login e redirecionar
um usuário autenticado. O dashboard e as páginas de detalhe continuarão
validando a sessão no servidor e exigindo o usuário autenticado antes de
consultar o repositório.

O `proxy.ts` atualizará cookies de sessão quando necessário, mas não será a
única camada de autorização. APIs privadas continuarão retornando `401` sem
sessão e usando o usuário verificado para escopar os dados.

Para evitar duplicação, o formulário e as ações de autenticação serão
compartilhados entre a tela raiz e os fluxos de conta. A rota `/login` não terá
uma segunda tela de login.

## Estados e erros

`/` exibirá estado de carregamento durante o login, erros acionáveis para
credenciais inválidas ou e-mail não confirmado, além de links para cadastro e
recuperação de senha. O cadastro continuará exibindo a orientação para
confirmar o e-mail.

`/dashboard` preservará os estados existentes de workspace: lista vazia,
processamento, falha recuperável e upload. O logout também terá estado de
carregamento e retornará à raiz quando concluído.

## Verificação

Os testes deverão cobrir:

- visitante em `/` vendo o login;
- usuário autenticado em `/` sendo redirecionado para `/dashboard`;
- `/login` redirecionando para `/`;
- visitante tentando acessar dashboard e detalhe, com preservação segura de
  `next`;
- login retornando ao destino original ou ao dashboard padrão;
- logout retornando para `/`;
- bloqueio das APIs privadas sem sessão;
- acesso público preservado para `/share/[token]`.

Antes de considerar a mudança concluída, executar `npm run check` e exercitar o
fluxo real de login, logout, upload e acesso ao dashboard.

## Fora de escopo

- Alterar o modelo de autenticação ou adicionar provedores sociais.
- Alterar o formato das páginas públicas de compartilhamento.
- Redesenhar o workspace além da mudança necessária de rota.
- Criar uma segunda implementação de login em `/login`.
