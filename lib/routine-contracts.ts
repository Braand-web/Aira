import {z} from 'zod';
export const ROUTINE_LABELS = {draft:'À approuver',active:'Active',paused:'En pause',blocked:'À examiner',completed:'Terminée',cancelled:'Annulée',expired:'Expirée'} as const;
export type RoutineStatus = keyof typeof ROUTINE_LABELS;
export const routineInput = z.object({
    sourceWorkId:z.string().min(1).max(160), sourceVersion:z.number().int().positive(),
    title:z.string().trim().min(1).max(160), intervalHours:z.number().int().min(1).max(168),
    firstRunAt:z.number().int().positive(), expiresAt:z.number().int().positive(),
    maxRuns:z.number().int().min(1).max(30), maxCredits:z.number().int().min(1).max(1000),
}).strict();
export const routineCommand = z.object({action:z.enum(['activate','pause','resume','cancel']),version:z.number().int().positive(),digest:z.string().regex(/^[a-f0-9]{64}$/),approved:z.boolean().optional()}).strict();
export type RoutineDTO = {
    id:string; title:string; sourceWorkId:string; status:RoutineStatus; version:number; digest:string;
    intervalHours:number; timezone:string; firstRunAt:number; nextAt:number; expiresAt:number;
    maxRuns:number; maxCredits:number; perRunCredits:number; committedCredits:number; spentCredits:number; reservedCredits:number;
    objective:string; criteria:string[]; errorCode:string|null;
    runs:{workId:string;ordinal:number;scheduledAt:number;status:string;objective:string}[];
};
// Fixed intervals, explicitly displayed as such. No implicit wall-clock/DST rule.
// A delayed tick skips missed slots; it never creates a catch-up burst.
export function nextRoutineSlot(firstAt:number,intervalHours:number,after:number){
    const interval=intervalHours*3600000;
    return firstAt+(Math.max(0,Math.floor((after-firstAt)/interval))+1)*interval;
}
