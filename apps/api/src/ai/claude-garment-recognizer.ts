import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { EnvironmentVariables } from '../config/env.validation.js';
import { DEFAULT_AI_MODEL as DEFAULT_MODEL } from '../integrations/integration-config.js';
import { IntegrationConfigService } from '../integrations/integration-config.service.js';
import {
  GarmentRecognizer,
  RecognitionError,
  type RecognitionImage,
  type RecognitionResult,
} from './garment-recognizer.js';

/** Structured output: Spanish keys, matching the agreed JSON contract. No price/brand/fabric fields exist. */
const GarmentSchema = z.object({
  es_prenda: z.boolean(),
  nombre: z.string(),
  descripcion: z.string(),
  tipo: z.string(),
  categoria: z.string(),
  color_principal: z.string(),
  colores_secundarios: z.array(z.string()),
  talla: z.string().nullable(),
  estilo: z.string(),
  caracteristicas: z.array(z.string()),
  etiquetas: z.array(z.string()),
  mensaje: z.string(),
});

const SYSTEM_PROMPT = `Eres el asistente de registro de prendas de una tienda de ropa en Bolivia. Recibes de 1 a 4 fotografías de UNA misma prenda (por ejemplo frente, espalda y etiqueta) y devuelves los datos para su ficha, en español y con un tono comercial breve.

Describe solo lo que se ve en las fotos:
- nombre: corto y vendible (máximo 6 palabras), sin marcas. Ejemplo: "Blusa roja de manga larga".
- descripcion: una o dos frases sobre corte, cuello, mangas y detalles visibles.
- tipo: el tipo de prenda en singular (Blusa, Camisa, Pantalón, Vestido, Falda, Chaqueta, Polera, Short, Accesorio...).
- categoria: la categoría de la tienda que mejor corresponda, escrita exactamente como en la lista recibida; si ninguna encaja, deja "".
- color_principal: el color dominante con un nombre simple (Rojo, Negro, Azul marino, Beige...). colores_secundarios: otros colores visibles relevantes, o [].
- estilo: Casual, Formal, Deportivo, Elegante, Urbano, etc.
- caracteristicas: detalles visibles (manga larga, escote en V, botones, estampado floral...).
- etiquetas: 3 a 10 palabras o frases cortas en minúscula útiles para buscar (tipo, color, estilo, ocasión), sin repetir.

Reglas estrictas:
- No inventes datos que no se puedan ver: nunca indiques precio, costo, cantidad, marca ni composición o material de la tela. Si la tela parece de punto o satinada, dilo solo como apariencia en la descripción.
- talla: solo si se lee con claridad en una etiqueta visible (por ejemplo "M" o "38"); en cualquier otro caso usa null.
- Si un dato no se puede identificar, déjalo vacío ("" o []).
- Ignora el maniquí, el fondo y las prendas que solo acompañan la foto.
- Si no hay ninguna prenda o accesorio de vestir, usa es_prenda=false, deja los demás campos vacíos y explica el motivo en mensaje.
- Si las fotos parecen de prendas distintas o hay varias prendas a la venta, describe la principal y explícalo en mensaje. Si todo está bien, deja mensaje vacío.`;

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);

@Injectable()
export class ClaudeGarmentRecognizer extends GarmentRecognizer {
  private readonly logger = new Logger(ClaudeGarmentRecognizer.name);
  private readonly timeoutMs: number;
  private cached: { apiKey: string; client: Anthropic } | null = null;

  constructor(
    private readonly integrations: IntegrationConfigService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
    this.timeoutMs = config.get('AI_TIMEOUT_MS', { infer: true }) ?? 60_000;
  }

  get configured(): boolean {
    return this.integrations.snapshot().ai !== null;
  }

  get model(): string {
    return this.integrations.snapshot().ai?.model ?? DEFAULT_MODEL;
  }

  private get client(): Anthropic | null {
    const ai = this.integrations.snapshot().ai;
    if (!ai) return null;
    if (this.cached?.apiKey !== ai.apiKey) this.cached = { apiKey: ai.apiKey, client: new Anthropic({ apiKey: ai.apiKey, timeout: this.timeoutMs, maxRetries: 1 }) };
    return this.cached.client;
  }

  async recognize(images: RecognitionImage[], storeCategories: string[]): Promise<RecognitionResult> {
    const client = this.client;
    const model = this.model;
    if (!client) throw new RecognitionError('AI_UNAVAILABLE', 'AI is not configured', false);

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...images.map(
        (img): Anthropic.Beta.BetaContentBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data.toString('base64') },
        }),
      ),
      {
        type: 'text',
        text:
          `Categorías de la tienda: ${storeCategories.length ? storeCategories.join(', ') : '(sin categorías)'}.\n` +
          `Analiza ${images.length === 1 ? 'la fotografía' : `las ${images.length} fotografías`} de la prenda y completa la ficha.`,
      },
    ];

    let response;
    try {
      response = await client.beta.messages.parse({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        // Simple extraction: low effort keeps it fast and inexpensive.
        output_config: { effort: 'low', format: betaZodOutputFormat(GarmentSchema) },
        // If a safety classifier declines, the API retries on a fallback model in the same call.
        ...(SERVER_FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      });
    } catch (error) {
      throw this.mapError(error);
    }

    if (response.stop_reason === 'refusal') {
      this.logger.warn(`Garment analysis refused (category: ${response.stop_details?.category ?? 'n/a'})`);
      throw new RecognitionError('AI_INVALID_RESPONSE', 'refusal', false);
    }
    const parsed = response.parsed_output;
    if (response.stop_reason === 'max_tokens' || !parsed) {
      throw new RecognitionError('AI_INVALID_RESPONSE', `unparseable output (${response.stop_reason})`, true);
    }

    return {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      suggestion: {
        isGarment: parsed.es_prenda,
        name: parsed.nombre,
        description: parsed.descripcion,
        garmentType: parsed.tipo,
        category: parsed.categoria,
        mainColor: parsed.color_principal,
        secondaryColors: parsed.colores_secundarios,
        size: parsed.talla,
        style: parsed.estilo,
        features: parsed.caracteristicas,
        tags: parsed.etiquetas,
        message: parsed.mensaje,
      },
    };
  }

  private mapError(error: unknown): RecognitionError {
    if (error instanceof Anthropic.RateLimitError) {
      return new RecognitionError('AI_UNAVAILABLE', 'rate limited', true);
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      this.logger.error('Claude API rejected the credentials (check the Claude API key in the admin panel or ANTHROPIC_API_KEY).');
      return new RecognitionError('AI_UNAVAILABLE', 'auth', false);
    }
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
      this.logger.error(`Claude API rejected the request (${error.status}): check the Claude model "${this.model}".`);
      return new RecognitionError('AI_UNAVAILABLE', 'bad request', false);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new RecognitionError('AI_UNAVAILABLE', 'connection/timeout', true);
    }
    if (error instanceof Anthropic.APIError) {
      return new RecognitionError('AI_UNAVAILABLE', `api error ${error.status}`, true);
    }
    return new RecognitionError('AI_UNAVAILABLE', (error as Error)?.name ?? 'unknown', true);
  }
}
