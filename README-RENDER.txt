ÉLORA BEAUTY — VERSÃO PARA RENDER (BACKEND + POSTGRESQL)

ESTA VERSÃO TEM BACKEND REAL
- Node.js + Express
- PostgreSQL (dados persistentes)
- Sessões de login salvas no PostgreSQL
- Senhas protegidas com bcrypt
- Painel do vendedor protegido por login e permissões
- Cadastro de produtos e serviços pelo painel
- Controle de disponibilidade / pausa de novos agendamentos
- Lista de agendamentos recebidos com ações para confirmar, recusar, cancelar e concluir
- Clientes podem solicitar horários na página pública da profissional
- Área Meus pedidos para clientes: compras feitas, itens, profissional/loja e situação; agendamentos e com quem foram marcados
- Área Pedidos da minha loja para profissionais: produtos pedidos por cliente, quantidades, total e atualização do status
- Cliente pode pedir produto diretamente na página da profissional; o sistema registra o pedido e atualiza o estoque
- Upload de fotos para Cloudinary (armazenamento externo)
- Render Blueprint para criar o serviço e o banco

1) COLOCAR O PROJETO NO GITHUB
1. Extraia o ZIP.
2. Crie um repositório no GitHub.
3. Envie todos os arquivos e pastas do projeto para esse repositório.
   O arquivo render.yaml deve ficar na raiz do repositório.

2) PUBLICAR NO RENDER
1. Entre em https://render.com e faça login.
2. Clique em New > Blueprint.
3. Conecte o GitHub e escolha o repositório do ÉLORA BEAUTY.
4. O Render vai ler render.yaml e mostrar os recursos que serão criados.
5. Confirme a criação. O Render instala as dependências, cria o PostgreSQL e inicia o backend.
6. Quando terminar, abra o endereço .onrender.com do serviço.

3) CONFIGURAR AS FOTOS (CLOUDINARY)
O Render não deve guardar fotos no disco temporário do servidor. Para que fotos de perfil e produtos continuem salvas, use o Cloudinary:
1. Crie uma conta em https://cloudinary.com.
2. No painel do Cloudinary, copie Cloud Name, API Key e API Secret.
3. No Render, abra o serviço elora-beauty > Environment.
4. Preencha:
   CLOUDINARY_CLOUD_NAME
   CLOUDINARY_API_KEY
   CLOUDINARY_API_SECRET
5. Salve as alterações e aguarde o redeploy.

4) TESTAR
- Abra https://SEU-SITE.onrender.com/api/health
- Deve aparecer uma resposta JSON com "ok": true.
- Abra a página inicial e crie uma conta.
- Para testar o painel, crie uma conta como Vendedor(a) / Profissional.
- Cadastre foto, serviços, técnicas, produtos e horários no painel.
- Marque se está aceitando agendamentos ou pause o recebimento quando estiver fora de expediente.
- Veja os agendamentos recebidos e atualize o status.
- Para o cliente agendar, ele precisa criar uma conta de Comprador(a), abrir a página de uma profissional e preencher o formulário de reserva.

IMPORTANTE SOBRE O BANCO
- O PostgreSQL do Render guarda os cadastros fora do sistema de arquivos temporário do servidor.
- O plano gratuito do banco pode ter limites e prazo de validade definidos pelo Render. Para um projeto em produção, confira os planos e regras atuais e use um banco pago com backups.
- Nunca compartilhe SESSION_SECRET, DATABASE_URL ou as chaves do Cloudinary.
- Para rodar localmente, crie um PostgreSQL, copie .env.example para .env, preencha DATABASE_URL e as chaves do Cloudinary, instale dependências com npm install e execute npm start.

LIMITES DESTA VERSÃO
O backend já atende cadastro/login, sessão, perfil público, perfil do vendedor, foto, serviços, técnicas, produtos e horários. Inclui solicitação de agendamento e gestão básica de status pela profissional. Ainda não inclui pagamentos online, integração de frete/entrega, cancelamento de pedidos pelo cliente, lembretes automáticos nem calendário de disponibilidade com bloqueio de duração sobreposto. O botão de pedido registra uma solicitação de compra sem cobrança online. Essas partes devem ser desenvolvidas antes de abrir a plataforma para clientes reais.
