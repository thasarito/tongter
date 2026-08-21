import { dietaryOptions } from "@/shared/event-config";
import { isLang } from "@/shared/i18n";
import { MAX_TEXT } from "@/shared/rsvp-form";
import { z } from "zod";

export const langSchema = z.string().transform((value) =>
  isLang(value) ? value : "th",
);

const dietaryIds = new Set(dietaryOptions.map((option) => option.id));

export const rsvpSubmissionSchema = z.object({
  submittedBy: z.string().min(1).max(200),
  lang: z.enum(["th", "en"]),
  answers: z
    .array(
      z.object({
        guestId: z.string().min(1).max(200),
        attending: z.boolean(),
        dietary: z.array(z.string()).transform((ids) =>
          [...new Set(ids.filter((id) => dietaryIds.has(id)))],
        ),
        dietaryOther: z.string().max(MAX_TEXT).default(""),
        note: z.string().max(MAX_TEXT).default(""),
      }),
    )
    .min(1),
});

export const apiError = <Code extends string>(code: Code, message: string) => ({
  error: { code, message },
});
