import {z} from 'zod';

// Browser-safe DTO only. Do not import the server registry or method content here.
export const reviewedSkillMetadataSchema=z.object({
 id:z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 title:z.string().min(1).max(160),description:z.string().min(1).max(1200),
 category:z.enum(['marketing','creative','documents','operations']),
 capability:z.enum(['workspace_context','text_and_page_draft','media_proposal','campaign_plan','text_draft','provided_data_analysis','document_content_only']),
 version:z.string().min(1).max(80),
}).strict();
export const reviewedSkillCatalogSchema=z.object({skills:z.array(reviewedSkillMetadataSchema).max(100)}).strict();
export type ReviewedSkillMetadata=z.infer<typeof reviewedSkillMetadataSchema>;
