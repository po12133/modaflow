import type { BillingPeriod, CatalogAccess, UsagePeriod } from '../generated/prisma/enums.js';

/**
 * Plan catalog loaded into the database by the Prisma seed (upsert by `code`).
 * At runtime, limits and features are always read from the `plans` table.
 * Prices and limits are the initial commercial proposal for ModaFlow.
 */
export interface PlanDefinition {
  code: string;
  name: string;
  tagline: string;
  priceCents: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isTrial: boolean;
  isRecommended: boolean;
  sortOrder: number;
  maxProducts: number;
  aiAnalysesLimit: number;
  aiAnalysesPeriod: UsagePeriod;
  maxUsers: number;
  maxBranches: number;
  inventoryAndSales: boolean;
  advancedReports: boolean;
  onlineCatalog: CatalogAccess;
  advancedManagement: boolean;
  highlights: string[];
}

export const TRIAL_PLAN_CODE = 'gratis';
export const TRIAL_DURATION_DAYS = 14;
/** Days data is kept after a subscription expires (policy; no automatic deletion yet). */
export const DATA_RETENTION_DAYS = 30;

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    code: 'gratis',
    name: 'Gratis',
    tagline: 'Prueba ModaFlow con tu propia tienda durante 14 días, sin tarjeta.',
    priceCents: 0,
    billingPeriod: 'TRIAL',
    durationDays: TRIAL_DURATION_DAYS,
    isTrial: true,
    isRecommended: false,
    sortOrder: 0,
    maxProducts: 30,
    aiAnalysesLimit: 10,
    aiAnalysesPeriod: 'TOTAL',
    maxUsers: 1,
    maxBranches: 1,
    inventoryAndSales: true,
    advancedReports: true,
    onlineCatalog: 'TEMPORARY',
    advancedManagement: false,
    highlights: [
      'Hasta 30 productos',
      '10 análisis con IA en total',
      'Inventario y ventas',
      'Reportes avanzados, gráficos y exportación',
      'Catálogo online temporal',
    ],
  },
  {
    code: 'basico',
    name: 'Básico',
    tagline: 'Para dejar el cuaderno: inventario y ventas al día.',
    priceCents: 3000,
    billingPeriod: 'MONTHLY',
    durationDays: null,
    isTrial: false,
    isRecommended: false,
    sortOrder: 1,
    maxProducts: 150,
    aiAnalysesLimit: 20,
    aiAnalysesPeriod: 'MONTHLY',
    maxUsers: 1,
    maxBranches: 1,
    inventoryAndSales: true,
    advancedReports: false,
    onlineCatalog: 'NONE',
    advancedManagement: false,
    highlights: [
      'Hasta 150 productos',
      '20 análisis con IA al mes',
      'Inventario por tallas y colores',
      'Ventas ilimitadas',
      'Reportes básicos: resumen e historial de ventas',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    tagline: 'Para vender también por internet y saber cuánto ganas.',
    priceCents: 6900,
    billingPeriod: 'MONTHLY',
    durationDays: null,
    isTrial: false,
    isRecommended: true,
    sortOrder: 2,
    maxProducts: 1000,
    aiAnalysesLimit: 100,
    aiAnalysesPeriod: 'MONTHLY',
    maxUsers: 3,
    maxBranches: 1,
    inventoryAndSales: true,
    advancedReports: true,
    onlineCatalog: 'FULL',
    advancedManagement: false,
    highlights: [
      'Hasta 1.000 productos',
      '100 análisis con IA al mes',
      'Hasta 3 usuarios',
      'Reportes avanzados: ganancias, gráficos, comparaciones y Excel/PDF',
      'Catálogo online con pedidos por WhatsApp',
    ],
  },
  {
    code: 'premium',
    name: 'Premium',
    tagline: 'Para tiendas con sucursales y equipo.',
    priceCents: 11900,
    billingPeriod: 'MONTHLY',
    durationDays: null,
    isTrial: false,
    isRecommended: false,
    sortOrder: 3,
    maxProducts: 5000,
    aiAnalysesLimit: 300,
    aiAnalysesPeriod: 'MONTHLY',
    maxUsers: 10,
    maxBranches: 3,
    inventoryAndSales: true,
    advancedReports: true,
    onlineCatalog: 'FULL',
    advancedManagement: true,
    highlights: [
      'Hasta 5.000 productos',
      '300 análisis con IA al mes',
      'Hasta 10 usuarios y 3 sucursales',
      'Todos los reportes avanzados',
      'Gestión avanzada: proveedores, compras y gastos',
      'Catálogo online con pedidos por WhatsApp',
    ],
  },
];
