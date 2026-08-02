import { z } from 'zod';

// --------------------------------------------------------------------------
// Zod Schemas for AI and Log Parsing Validation
// --------------------------------------------------------------------------

export const VariantMetaSchema = z.object({
    isometric: z.boolean().optional().nullable(),
    legMode: z.enum(['single','double','alternating']).optional().nullable(),
    armMode: z.enum(['single','double','alternating']).optional().nullable(),
    unilateral: z.boolean().optional().nullable(),
    isAngled: z.boolean().optional().nullable(),
    angleDeg: z.number().optional().nullable(),
    equipment: z.string().optional().nullable(),
    equipmentSubType: z.string().optional().nullable(),
    angleRange: z.any().optional().nullable()
});

export const VariantPresetSchema = z.object({
    label: z.string(),
    variantMeta: VariantMetaSchema
});

export const MasterDataSchema = z.object({
    muscleGroup: z.string(),
    primaryMuscle: z.string(),
    secondaryMuscle: z.string().nullable(),
    musclesInvolved: z.array(z.string()),
    mechanics: z.enum(['Compound', 'Isolation']),
    forceType: z.string(),
    movementPattern: z.array(z.string()),
    jointAction: z.array(z.string()),
    equipment: z.array(z.string()).optional(),
    grip: z.string().nullable().optional(),
    planeOfMotion: z.string(),
    unilateral: z.boolean(),
    tags: z.array(z.string())
});

export const ExerciseAISchema = z.object({
    name: z.string(),
    masterData: MasterDataSchema,
    variantPresets: z.array(z.object({
        label: z.string(),
        variantMeta: VariantMetaSchema
    })).optional()
});

export const WorkoutLogParseSchema = z.object({
    date: z.string().nullable(),
    workout: z.array(z.object({
        exerciseName: z.string(),
        sets: z.array(z.object({
            weight: z.number(),
            reps: z.number(),
            failed: z.boolean()
        }))
    }))
});
