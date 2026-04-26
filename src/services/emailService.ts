import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const defaultFrom = process.env.SMTP_FROM || 'Sistema de Gestão <noreply@gestao.com>';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // If no SMTP configured, log to console for development
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('--- EMAIL SIMULATION ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML contents briefly:', html.substring(0, 500) + '...');
    console.log('--- END SIMULATION ---');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject,
      html,
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(to: string, nome: string, senhaTemp: string) {
  const subject = 'Bem-vindo ao Sistema de Gestão';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">Bem-vindo, ${nome}!</h2>
      <p>Sua conta foi criada com sucesso no Sistema de Gestão Geoplan.</p>
      <p>Abaixo estão suas credenciais de acesso:</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Usuário:</strong> ${to}</p>
        <p style="margin: 5px 0;"><strong>Senha Temporária:</strong> ${senhaTemp}</p>
      </div>
      <p>Recomendamos que você altere sua senha assim que realizar o primeiro login, através do menu de Configurações.</p>
      <a href="${process.env.APP_URL || '#'}" style="display: inline-block; background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Acessar o Sistema</a>
      <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
      <p style="color: #64748b; font-size: 12px;">Esta é uma mensagem automática, por favor não responda.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

export async function sendPasswordResetEmail(to: string, nome: string, token: string) {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
  const subject = 'Recuperação de Senha';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">Olá, ${nome}!</h2>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p>Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
      <p>Para redefinir sua senha, clique no botão abaixo:</p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Redefinir Senha</a>
      <p>Ou copie e cole o link abaixo no seu navegador:</p>
      <p style="word-break: break-all; color: #64748b; font-size: 14px;">${resetUrl}</p>
      <p>Este link é válido por 1 hora.</p>
      <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
      <p style="color: #64748b; font-size: 12px;">Esta é uma mensagem automática, por favor não responda.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}
