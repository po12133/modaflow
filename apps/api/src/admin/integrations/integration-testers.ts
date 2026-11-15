import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { AiConfig, EmailConfig, StorageConfig } from '../../integrations/integration-config.js';
import { fromHeader, smtpTransport } from '../../mail/mail.service.js';
import { s3Clients } from '../../storage/storage.service.js';

export interface TestResult {
  ok: boolean;
  message: string;
}

const NETWORK = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ECONNRESET|TimeoutError/;

function s3Message(error: unknown): string {
  const e = error as { name?: string; code?: string; message?: string };
  if (e.name === 'NoSuchBucket') return 'El bucket no existe en ese proveedor.';
  if (['InvalidAccessKeyId', 'SignatureDoesNotMatch', 'AccessDenied', 'Forbidden', 'InvalidClientTokenId'].includes(e.name ?? '')) return 'Las credenciales no son válidas o no tienen permiso de escritura en el bucket.';
  if (NETWORK.test(`${e.name} ${e.code} ${e.message}`)) return 'No se pudo conectar con el endpoint. Revisa la URL y que sea accesible desde el servidor.';
  return `El proveedor S3 rechazó la prueba (${e.name ?? 'error desconocido'}).`;
}

export async function testStorage(cfg: StorageConfig): Promise<TestResult> {
  const { client, signer } = s3Clients(cfg);
  const Key = `platform/healthcheck/${randomUUID()}.txt`;
  try {
    await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key, Body: 'ModaFlow', ContentType: 'text/plain' }));
    await client.send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: [{ Key }], Quiet: true } }));
    return { ok: true, message: `Conexión correcta: se subió y borró un archivo de prueba en "${cfg.bucket}".` };
  } catch (error) {
    return { ok: false, message: s3Message(error) };
  } finally {
    client.destroy();
    signer.destroy();
  }
}

export async function testAi(cfg: AiConfig): Promise<TestResult> {
  try {
    const model = await new Anthropic({ apiKey: cfg.apiKey, timeout: 15_000, maxRetries: 0 }).models.retrieve(cfg.model);
    return { ok: true, message: `Llave válida. Modelo disponible: ${model.display_name || cfg.model}.` };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: 'La llave de Claude no es válida.' };
    if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, message: 'La llave de Claude no tiene permiso para usar la API.' };
    if (error instanceof Anthropic.NotFoundError) return { ok: false, message: `El modelo "${cfg.model}" no existe o no está disponible para esta llave.` };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: 'No se pudo conectar con la API de Claude.' };
    return { ok: false, message: 'Claude rechazó la prueba. Revisa la llave y el modelo.' };
  }
}

function smtpMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'EAUTH') return 'Usuario o contraseña SMTP incorrectos.';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(code)) return 'No se pudo conectar con el servidor SMTP. Revisa servidor, puerto y si usa conexión segura (465) o STARTTLS (587).';
  if (code === 'EENVELOPE') return 'El servidor rechazó el remitente o el destinatario.';
  return 'El servidor SMTP rechazó la prueba.';
}

export async function testEmail(cfg: EmailConfig, to: string): Promise<TestResult> {
  const transport = smtpTransport(cfg);
  try {
    await transport.verify();
    await transport.sendMail({ from: fromHeader(cfg), to, subject: 'Prueba de correo de ModaFlow', text: 'Este es un correo de prueba enviado desde el panel de administración de ModaFlow. Si lo recibes, la configuración SMTP funciona.' });
    return { ok: true, message: `Correo de prueba enviado a ${to}.` };
  } catch (error) {
    return { ok: false, message: smtpMessage(error) };
  } finally {
    transport.close();
  }
}
