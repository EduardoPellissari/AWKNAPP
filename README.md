# AWKNAPP

Aplicativo web instalavel para o ministerio de musica awkn!.

## Publicar no Render

Este projeto deve ser publicado como **Web Service Node**, nao como Docker.

### Arquivos obrigatorios

Estes arquivos precisam estar no GitHub:

- `package.json`
- `package-lock.json`
- `server.js`
- `render.yaml`
- `index.html`
- `app.js`
- `styles.css`
- `manifest.json`
- `sw.js`
- imagens e icones

### Usando Blueprint

No Render:

1. New + > Blueprint
2. Selecione o repositorio
3. Branch: use a branch onde esta o arquivo `render.yaml`
4. Blueprint Path:
   - use `render.yaml` se os arquivos estao na raiz do repositorio
   - use `AWKNAPP/render.yaml` se os arquivos estao dentro de uma pasta chamada `AWKNAPP`
5. Clique em Apply.

O Blueprint cria:

- Web Service: `awknapp`
- Postgres: `awknapp-db`
- Variavel `DATABASE_URL`

### Criando manualmente

Se o Render pedir Docker, cancele e crie manualmente:

1. New + > PostgreSQL
   - Name: `awknapp-db`
2. New + > Web Service
   - Runtime: Node
   - Build Command: `npm install --package-lock=false`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
3. Em Environment, adicione:
   - `DATABASE_URL`
   - valor: Internal Database URL do Postgres criado no Render

### Root Directory

- Coloque `.` se `package.json` e `server.js` aparecem direto na primeira tela do repositorio.
- Coloque `AWKNAPP` se eles estao dentro de uma pasta chamada `AWKNAPP`.

### Baixar como app

Depois de publicado, abra a URL do Render no celular:

- iPhone: Safari > Compartilhar > Adicionar a Tela de Inicio
- Android: Chrome > Instalar app

Tambem existe um botao **Baixar app** dentro do aplicativo.

Para os dados ficarem iguais no computador e no celular, abra sempre a mesma URL publicada no Render. Se abrir `localhost`, arquivo local ou uma previa antiga, aquele aparelho fica em modo local e nao compartilha missoes com os outros.

### Notificacoes automaticas

Para receber notificacoes quando for escalado:

1. Cada musico precisa abrir o app no proprio celular.
2. Entrar com o login individual.
3. Tocar em **Notificacoes** e permitir.

Depois disso, quando esse musico for escalado em uma nova missao, o servidor envia a notificacao para o celular cadastrado.

No iPhone, notificacoes automaticas funcionam pelo app instalado na Tela de Inicio. No Android, funcionam pelo Chrome/app instalado.

## Rodar localmente

```bash
npm install
npm start
```

Sem `DATABASE_URL`, o app roda em modo local. No Render, com Postgres, os dados ficam compartilhados.
