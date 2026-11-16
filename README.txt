ÉLORA BEAUTY — SITE COM PAINEL DE VENDEDOR E BANCO DE DADOS

REQUISITOS
- Node.js instalado no computador.
- Conexão com internet na primeira instalação para baixar dependências.

INSTALAÇÃO
1. Extraia a pasta ZIP.
2. Abra a pasta "amora_beauty_completo" no Visual Studio Code.
3. Abra o terminal dentro dessa pasta.
4. Execute: npm install
5. Depois execute: npm start
6. Abra no navegador: http://localhost:3000

COMO USAR
- Acesse Criar conta.
- Escolha "Vendedor(a) / Profissional" para criar uma conta de vendedor.
- Após o cadastro, o sistema abre o painel do vendedor.
- No painel, a profissional consegue:
  * editar nome, especialidade, cidade, descrição, Instagram e WhatsApp;
  * enviar foto de perfil;
  * cadastrar serviços, preços, duração e técnicas (ex.: Gatinho, Brasileiro);
  * cadastrar produtos, preços, estoque e foto;
  * configurar os dias e horários em que atende.
- Compradores criam conta como Comprador(a), entram no site e visualizam as páginas públicas dos profissionais.
- Cada vendedor só consegue editar os próprios dados.

BANCO
O banco SQLite é criado automaticamente em data/amora_beauty.db quando o servidor inicia pela primeira vez. Não coloque a pasta data em hospedagem pública para download.

IMPORTANTE
- Esta entrega conecta cadastro/login, perfis, fotos, serviços, técnicas, produtos e horários ao banco.
- O painel de horários configura o expediente. A criação e confirmação de agendamentos e o fluxo completo de pedidos ainda precisam de endpoints adicionais para produção.
- O login usa sessão no servidor e bcrypt para hash de senha.
- Antes de publicar na internet, defina SESSION_SECRET forte em variável de ambiente, use HTTPS e configure armazenamento/backup de banco e imagens.
