import { env } from '../../config/env.js';
import { logger } from '../logger.js';

let transport;

async function getTransport() {
  if (transport) return transport;
  const nodemailer = await import('nodemailer');
  if (env.SMTP_HOST) {
    transport = nodemailer.default.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    transport = {
      sendMail: async (opts) => {
        logger.info(
          { to: opts.to, subject: opts.subject, text: opts.text },
          'email (SMTP not configured – logged only)'
        );
        return { messageId: 'dev-log' };
      },
    };
  }
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  const t = await getTransport();
  await t.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
}