import { z } from 'zod';

export const DrawingClassificationSchema = z.object({
  pageNumber: z.number(),
  sheetId: z.string().describe('Sheet identifier like A1.01, M2.03'),
  sheetTitle: z.string().optional(),
  discipline: z.enum([
    'architectural_floor_plan',
    'enlarged_plan',
    'finish_schedule',
    'detail_sheet',
    'reflected_ceiling_plan',
    'demolition_plan',
    'elevation',
    'section',
    'cover_sheet',
    'mechanical',
    'electrical',
    'plumbing',
    'structural',
    'civil',
    'interior_design',
    'other',
  ]),
  relevanceToFlooring: z.enum(['high', 'medium', 'low', 'none']),
  flooringNotes: z.string().optional().describe('Any flooring-related content spotted on this sheet'),
  detailTypes: z.array(z.string()).optional().describe('e.g., transitions, base, stair nosing'),
  phase: z.string().optional(),
});

export const DrawingSetResultSchema = z.object({
  totalPages: z.number(),
  classifications: z.array(DrawingClassificationSchema),
  summary: z.object({
    highRelevance: z.number(),
    mediumRelevance: z.number(),
    lowRelevance: z.number(),
    noRelevance: z.number(),
  }),
});

export type DrawingClassification = z.infer<typeof DrawingClassificationSchema>;
export type DrawingSetResult = z.infer<typeof DrawingSetResultSchema>;
