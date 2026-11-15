/** Garment data suggested by the AI. Prices, quantity, brand and fabric are never part of it. */
export interface GarmentSuggestion {
  isGarment: boolean;
  name: string;
  description: string;
  garmentType: string;
  /** Category name as suggested (matched to the store's categories by the service). */
  category: string;
  mainColor: string;
  secondaryColors: string[];
  /** Only when read on a visible label; otherwise null. */
  size: string | null;
  style: string;
  features: string[];
  tags: string[];
  /** Note for the seller (e.g. "several garments in the photo"). */
  message: string;
}

export interface RecognitionImage {
  data: Buffer;
  mediaType: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface RecognitionResult {
  suggestion: GarmentSuggestion;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Thrown by recognizers; `retryable` tells the user whether trying again may help. */
export class RecognitionError extends Error {
  constructor(
    readonly code: 'AI_UNAVAILABLE' | 'AI_INVALID_RESPONSE',
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Abstraction over the vision model, so credit logic can be tested without calling the API. */
export abstract class GarmentRecognizer {
  abstract readonly configured: boolean;
  abstract readonly model: string;
  abstract recognize(images: RecognitionImage[], storeCategories: string[]): Promise<RecognitionResult>;
}
