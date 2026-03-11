import { z } from 'zod';

export const FlooringProductSchema = z.object({
  csiSection: z.string().describe('e.g., 09 65 00'),
  sectionTitle: z.string().describe('e.g., Resilient Flooring'),
  manufacturers: z.array(z.object({
    name: z.string(),
    isBasisOfDesign: z.boolean().default(false),
  })).default([]),
  productName: z.string().optional().nullable(),
  colors: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  installMethod: z.string().optional().nullable(),
  installPattern: z.string().optional().nullable(),
  seamRequirements: z.string().optional().nullable(),
  flashCoveBase: z.string().optional().nullable(),
  atticStockPercent: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  moistureLimits: z.string().optional().nullable(),
  testingProtocol: z.string().optional().nullable(),
  specialNotes: z.array(z.string()).default([]),
});

export const SpecExtractionSchema = z.object({
  projectName: z.string().optional().nullable(),
  specDate: z.string().optional().nullable(),
  products: z.array(FlooringProductSchema).default([]),
  moistureTestingSection: z.object({
    protocol: z.string().optional().nullable(),
    frequency: z.string().optional().nullable(),
    responsibleParty: z.string().optional().nullable(),
    acceptableLimits: z.string().optional().nullable(),
    mitigationProducts: z.array(z.string()).default([]),
  }).optional().nullable(),
  submittalRequirements: z.string().optional().nullable(),
  generalNotes: z.array(z.string()).default([]),
  gotchas: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

export type FlooringProduct = z.infer<typeof FlooringProductSchema>;
export type SpecExtraction = z.infer<typeof SpecExtractionSchema>;
