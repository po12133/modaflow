import type { IntegrationSection, SectionDef } from "@/types/integrations";

export const INTEGRATION_TABS: Record<string, IntegrationSection> = { almacenamiento: "storage", ia: "ai", correo: "email" };

export const INTEGRATION_SECTIONS: Record<IntegrationSection, SectionDef> = {
  storage: {
    title: "Almacenamiento de imágenes (S3)",
    description: "Fotos de productos, logos, portadas, comprobantes de pago y el QR bancario. Bucket privado: enlaces firmados temporales. Bucket público: URLs cortas y directas.",
    fields: [
      { name: "s3Endpoint", label: "Endpoint", kind: "text", help: "Sin el nombre del bucket. Hetzner: https://nbg1.your-objectstorage.com · Vacío en AWS S3.", placeholder: "https://..." },
      { name: "s3PublicEndpoint", label: "Endpoint público (opcional)", kind: "text", help: "Normalmente vacío. Solo si los navegadores deben abrir las fotos en otro dominio." },
      { name: "s3Region", label: "Región", kind: "text", help: "auto en Cloudflare R2; us-east-1, sa-east-1… en AWS." },
      { name: "s3Bucket", label: "Bucket", kind: "text" },
      { name: "s3PublicUrls", label: "Imágenes públicas", kind: "boolean", help: "Sí = el bucket es público: las imágenes usan URLs cortas y directas que el navegador guarda en caché. Los comprobantes de pago siguen con enlace firmado." },
      { name: "s3KeyPrefix", label: "Carpeta dentro del bucket", kind: "text", placeholder: "modaflow", help: "Vacío = raíz del bucket. Si la cambias, los archivos ya subidos deben moverse a la nueva carpeta." },
    ],
    secrets: [
      { name: "s3AccessKeyId", label: "Access Key ID" },
      { name: "s3SecretAccessKey", label: "Secret Access Key", help: "Necesita permiso de lectura, escritura y borrado en el bucket." },
    ],
  },
  ai: {
    title: "Inteligencia artificial (Claude)",
    description: "Reconocimiento de prendas en las fotos. Sin llave, las tiendas registran productos de forma manual.",
    fields: [{ name: "anthropicModel", label: "Modelo", kind: "select", help: "Todos aceptan fotos. La prueba confirma que el modelo está disponible para tu llave." }],
    secrets: [{ name: "anthropicApiKey", label: "Llave de la API", help: "Se crea en console.anthropic.com. Cada análisis consume créditos de esa cuenta." }],
  },
  email: {
    title: "Correo (SMTP)",
    description: "Recuperación de contraseña de las tiendas y avisos por correo (pagos, vencimientos). Funciona con Gmail/Google Workspace, Zoho, Brevo, Mailgun, Amazon SES o tu hosting.",
    fields: [
      { name: "smtpHost", label: "Servidor SMTP", kind: "text", placeholder: "smtp.ejemplo.com" },
      { name: "smtpPort", label: "Puerto", kind: "number", placeholder: "587", help: "587 con STARTTLS · 465 con TLS directo." },
      { name: "smtpSecure", label: "TLS directo", kind: "boolean", help: "Sí solo para el puerto 465." },
      { name: "smtpUser", label: "Usuario", kind: "text", help: "Normalmente el correo de la cuenta." },
      { name: "smtpFromEmail", label: "Correo remitente", kind: "text", placeholder: "no-responder@modaflow.bo" },
      { name: "smtpFromName", label: "Nombre del remitente", kind: "text", placeholder: "ModaFlow" },
    ],
    secrets: [{ name: "smtpPassword", label: "Contraseña SMTP", help: "En Gmail usa una contraseña de aplicación, no la de tu cuenta." }],
  },
};

export const SOURCE_LABELS = { panel: "Panel", env: "Variable de entorno", none: "Sin configurar" } as const;
