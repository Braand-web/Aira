import {z} from 'zod';

const base = z.object({
    title: z.string().trim().min(1).max(160),
    clips: z.array(z.object({
        fileId: z.string().regex(/^[a-zA-Z0-9:_-]{1,160}$/),
        version: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
        trimStart: z.number().finite().min(0).max(3600), duration: z.number().finite().min(0.1).max(120),
    }).strict()).min(1).max(10),
    width: z.number().int().min(256).max(1920), height: z.number().int().min(256).max(1920),
    captions: z.array(z.object({text:z.string().min(1).max(300), start:z.number().finite().nonnegative(), end:z.number().finite().positive()}).strict()).max(60),
    maxCredits: z.number().int().positive().max(1000),
}).strict();
const limits = (p:z.infer<typeof base>, c:z.RefinementCtx) => {
    const duration=p.clips.reduce((sum,clip)=>sum+clip.duration,0);
    if(duration>180||p.width%2||p.height%2||p.width*p.height>2073600)
        c.addIssue({code:z.ZodIssueCode.custom,message:'Limites de durée ou de résolution dépassées.'});
    if(p.captions.some(caption=>caption.end<=caption.start||caption.end>duration))
        c.addIssue({code:z.ZodIssueCode.custom,message:'Les sous-titres doivent tenir dans la vidéo.'});
};
export const assemblyInput=base.superRefine(limits);
export const videoStyle=z.object({
    fit:z.enum(['contain','cover']), motion:z.enum(['none','zoom_in','zoom_out']),
    grade:z.enum(['natural','warm','cool','monochrome']),
    audioVolume:z.number().finite().min(0).max(1), fadeSeconds:z.number().finite().min(0).max(1),
}).strict();
export const videoEditInput=base.extend({style:videoStyle}).superRefine((p,c)=>{
    limits(p,c);
    if(p.clips.some(clip=>p.style.fadeSeconds*2>clip.duration))
        c.addIssue({code:z.ZodIssueCode.custom,message:'Les fondus doivent tenir dans chaque plan.'});
});
export const videoQualityReport=z.object({
    status:z.enum(['passed','warning']), duration:z.number().finite().positive().max(181),
    width:z.number().int().positive(),height:z.number().int().positive(),fps:z.number().finite().positive().max(120),
    framesSampled:z.number().int().min(1).max(12),sampleTimes:z.array(z.number().finite().nonnegative()).max(12),
    decode:z.literal('passed'),warnings:z.array(z.string().max(300)).max(12),
    semanticReview:z.literal('not_performed'),audioListening:z.literal('not_performed'),
}).strict();
