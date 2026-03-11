import { z } from 'zod';

export const BidSummarySchema = z.object({
  projectName: z.string(),
  projectLocation: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  gcName: z.string(),
  gcEstimator: z.string().optional().nullable(),
  gcEmail: z.string().optional().nullable(),
  gcPhone: z.string().optional().nullable(),
  bidDate: z.string(),
  bidTime: z.string().optional().nullable(),
  preBidDate: z.string().optional().nullable(),
  preBidMandatory: z.boolean().optional().nullable(),
  prevailingWage: z.boolean().optional().nullable(),
  scope: z.array(z.object({
    flooringType: z.string(),
    approxSF: z.string().optional().nullable(),
    product: z.string().optional().nullable(),
    manufacturer: z.string().optional().nullable(),
  })).default([]),
  moistureResponsibility: z.string().optional().nullable(),
  keyNotes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  addenda: z.array(z.string()).default([]),
  missingDocuments: z.array(z.string()).default([]),
  recommendation: z.enum(['BID', 'PASS', 'NEEDS_MORE_INFO']).default('NEEDS_MORE_INFO'),
  confidence: z.object({
    bidDate: z.enum(['high', 'medium', 'low']).default('low'),
    scope: z.enum(['high', 'medium', 'low']).default('low'),
    overall: z.enum(['high', 'medium', 'low']).default('low'),
  }).default({ bidDate: 'low', scope: 'low', overall: 'low' }),
});

export type BidSummary = z.infer<typeof BidSummarySchema>;
