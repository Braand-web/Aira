export type OfficeBlock = { type: "heading" | "paragraph" | "list"; level: number; text: string } | { type: "table"; rows: string[][] };
export type OfficeXlsxSheet = { name: string; hidden: boolean; truncated: boolean; rows: Array<{ number: number; cells: string[] }> };
export type OfficePptxSlide = { number: number; title: string; paragraphs: string[]; hasImages: boolean };
export type OfficePreviewResult =
  | { kind: "docx"; blocks: OfficeBlock[]; simplified: boolean; truncated: boolean; truncatedByText?: boolean }
  | { kind: "xlsx"; sheets: OfficeXlsxSheet[]; truncated: boolean; truncatedSheets: boolean; truncatedByText?: boolean }
  | { kind: "pptx"; slides: OfficePptxSlide[]; truncated: boolean; truncatedSlides: boolean; truncatedByText?: boolean };
export type OfficePreviewState = { status: "loading" } | { status: "ready"; result: OfficePreviewResult } | { status: "error"; code: string; message: string };
