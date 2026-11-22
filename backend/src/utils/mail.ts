/**
 * โมดูลส่งอีเมลผ่านโปรโตคอล SMTP โดยตรง (ใช้สำหรับส่งลิงก์รีเซ็ตรหัสผ่าน)
 */
import net from 'node:net';
import tls from 'node:tls';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendMailResult {
  sent: boolean;
  reason?: string;
}

// เข้ารหัสข้อความ UTF-8 เป็น Base64 สำหรับเนื้อหาและข้อมูลรับรอง SMTP
function encodeBase64Utf8(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

// เข้ารหัส Header อีเมลภาษาไทย/UTF-8 ตามมาตรฐาน MIME RFC 2047
function encodeHeaderUtf8(value: string): string {
  return `=?UTF-8?B?${encodeBase64Utf8(value)}?=`;
}

/**
 * ส่งอีเมลผ่าน SMTP รองรับทั้ง STARTTLS (พอร์ต 587 เช่น Microsoft 365 / Gmail) และ TLS (พอร์ต 465)
 * Minimal zero-dependency SMTP client supporting STARTTLS (port 587 - Microsoft 365 / Gmail)
 * and implicit TLS (port 465).
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !user || !pass || !from) {
    return { sent: false, reason: 'SMTP is not configured' };
  }

  const secureImplicit = port === 465;

  return new Promise((resolve, reject) => {
    let settled = false;
    let socket: net.Socket | tls.TLSSocket;
    let buffer = '';

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve({ sent: true });
    };

    const readResponse = (): Promise<{ code: number; text: string }> =>
      new Promise((res, rej) => {
        const checkBuffer = () => {
          const lines = buffer.split(/\r?\n/);
          // A complete SMTP multiline response ends with a line matching /^\d{3} /
          for (let i = 0; i < lines.length - 1; i += 1) {
            const line = lines[i] ?? '';
            if (/^\d{3} /.test(line)) {
              const consumed = lines.slice(0, i + 1).join('\r\n') + '\r\n';
              buffer = buffer.slice(consumed.length);
              cleanup();
              res({ code: Number(line.slice(0, 3)), text: lines.slice(0, i + 1).join('\n') });
              return;
            }
          }
        };

        const onData = (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          checkBuffer();
        };
        const onError = (err: Error) => {
          cleanup();
          rej(err);
        };
        const onClose = () => {
          cleanup();
          rej(new Error('SMTP connection closed unexpectedly'));
        };

        const cleanup = () => {
          socket.off('data', onData);
          socket.off('error', onError);
          socket.off('close', onClose);
        };

        socket.on('data', onData);
        socket.on('error', onError);
        socket.on('close', onClose);
        checkBuffer();
      });

    const sendCommand = async (cmd: string, expectedCodes: number[]) => {
      socket.write(`${cmd}\r\n`);
      const resp = await readResponse();
      if (!expectedCodes.includes(resp.code)) {
        throw new Error(`SMTP error (${resp.code}): ${resp.text}`);
      }
      return resp;
    };

    const runSmtpSession = async () => {
      try {
        const greeting = await readResponse();
        if (greeting.code !== 220) {
          throw new Error(`SMTP greeting error (${greeting.code}): ${greeting.text}`);
        }

        await sendCommand('EHLO localhost', [250]);

        if (!secureImplicit) {
          await sendCommand('STARTTLS', [220]);
          socket = tls.connect({ socket, servername: host });
          buffer = '';
          await new Promise<void>((res, rej) => {
            socket.once('secureConnect', res);
            socket.once('error', rej);
          });
          await sendCommand('EHLO localhost', [250]);
        }

        await sendCommand('AUTH LOGIN', [334]);
        await sendCommand(encodeBase64Utf8(user), [334]);
        await sendCommand(encodeBase64Utf8(pass), [235]);

        await sendCommand(`MAIL FROM:<${from}>`, [250]);
        await sendCommand(`RCPT TO:<${options.to}>`, [250, 251]);
        await sendCommand('DATA', [354]);

        const boundary = `utcc_${Date.now()}`;
        const mimeBody = [
          `From: "UTCC Sports System" <${from}>`,
          `To: <${options.to}>`,
          `Subject: ${encodeHeaderUtf8(options.subject)}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Utf8(options.text),
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Utf8(options.html),
          '',
          `--${boundary}--`,
          '.',
        ].join('\r\n');

        await sendCommand(mimeBody, [250]);
        try {
          await sendCommand('QUIT', [221]);
        } catch {
          // ignore quit errors after successful DATA
        }
        finish();
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    };

    socket = secureImplicit
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    socket.setTimeout(12_000, () => {
      finish(new Error('SMTP connection timed out'));
    });

    if (secureImplicit) {
      socket.once('secureConnect', () => void runSmtpSession());
    } else {
      socket.once('connect', () => void runSmtpSession());
    }

    socket.once('error', (err) => finish(err));
  });
}
