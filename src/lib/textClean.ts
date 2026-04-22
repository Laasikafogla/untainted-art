// Strip common AI watermark phrases and invisible/zero-width characters.

export const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\u200E\u200F\u2060-\u2064\u206A-\u206F\uFEFF\u00AD\u180E\u034F]/g;

const AI_PHRASES: RegExp[] = [
  /^\s*(certainly|sure|of course|absolutely|great question)[!,.\s-]*/gim,
  /\bas an ai (language )?model[, ]*/gi,
  /\bi am an ai (language )?model[, ]*/gi,
  /\bi'?m (just|only) an ai[, ]*/gi,
  /\bi (do not|don'?t) have (personal )?(opinions|feelings|beliefs)[^.]*\./gi,
  /\b(it'?s (important|worth) (to )?(note|mention|remember) that)[, ]*/gi,
  /\b(please note that|keep in mind that|it should be noted that)[, ]*/gi,
  /\bin conclusion,?\s*/gi,
  /\bi hope (this|that) helps[!.]?/gi,
  /\blet me know if you (have any|need) (questions|further (help|assistance))[!.]?/gi,
  /\bfeel free to ask[^.]*\./gi,
  /\bdisclaimer:[^\n]*\n?/gi,
  /\bnote:\s*as an ai[^\n]*\n?/gi,
];

export interface TextCleanResult {
  cleaned: string;
  removed: {
    zeroWidth: number;
    phrases: number;
    extraSpaces: number;
  };
}

export function cleanText(input: string, opts: { phrases: boolean; invisible: boolean; tidy: boolean }): TextCleanResult {
  let s = input;
  let zeroWidth = 0;
  let phrases = 0;
  let extraSpaces = 0;

  if (opts.invisible) {
    const matches = s.match(ZERO_WIDTH_REGEX);
    zeroWidth = matches ? matches.length : 0;
    s = s.replace(ZERO_WIDTH_REGEX, "");
  }

  if (opts.phrases) {
    for (const re of AI_PHRASES) {
      const m = s.match(re);
      if (m) phrases += m.length;
      s = s.replace(re, "");
    }
  }

  if (opts.tidy) {
    const before = s.length;
    s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
    extraSpaces = Math.max(0, before - s.length);
  }

  return { cleaned: s, removed: { zeroWidth, phrases, extraSpaces } };
}
