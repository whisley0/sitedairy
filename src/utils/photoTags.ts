import type { TFunction } from 'i18next';
import type { ClassifierOutput, HeadName } from '../native/cdv/classifier';

export interface PhotoClassifierMeta {
  inspectionType: string;
  domain: string;
  subject: string;
  tags: string[];
}

/** English labels for VLM prompts (model reasoning stays in English). */
export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  bme: 'BME — Building Services, Mechanical & Electrical',
  bel: 'BEL — Building Electrical',
  bpd: 'BPD — Building Pump and Drainage',
  fac: 'FAC — Facade',
  elv: 'ELV — Extra Low Voltage',
};

export const DOMAIN_LABELS_EN: Record<string, string> = {
  ceiling: 'Ceiling',
  facade: 'Facade',
  flooring: 'Flooring',
  housekeeping: 'Housekeeping',
  mep: 'MEP',
  paint: 'Paint',
  structural: 'Structural',
  waterproofing: 'Waterproofing',
};

export const SUBJECT_LABELS_EN: Record<string, string> = {
  concrete_work: 'Concrete work',
  floor_dry: 'Floor dry',
  formwork: 'Formwork',
  housekeeping: 'Housekeeping',
  paint_finish: 'Paint finish',
  rebar_fixing: 'Rebar forming',
  surface_defect: 'Surface defect',
  tbar_setup: 'T-bar setup',
  waterproofing: 'Waterproofing',
};

const INSPECTION_TYPE_ALIASES: Record<string, string> = Object.fromEntries([
  ...Object.keys(INSPECTION_TYPE_LABELS).map((code) => [code, code] as const),
  ...Object.entries(INSPECTION_TYPE_LABELS).flatMap(([code, label]) => [
    [label.toLowerCase(), code] as const,
    [code.toUpperCase(), code] as const,
  ]),
]);

const DOMAIN_ALIASES: Record<string, string> = Object.fromEntries([
  ...Object.keys(DOMAIN_LABELS_EN).map((code) => [code, code] as const),
  ...Object.entries(DOMAIN_LABELS_EN).map(([code, label]) => [label.toLowerCase(), code] as const),
]);

const SUBJECT_ALIASES: Record<string, string> = Object.fromEntries([
  ...Object.keys(SUBJECT_LABELS_EN).map((code) => [code, code] as const),
  ...Object.entries(SUBJECT_LABELS_EN).map(([code, label]) => [label.toLowerCase(), code] as const),
  ['tbar setup', 'tbar_setup'],
  ['t-bar setup', 'tbar_setup'],
  ['rebar forming', 'rebar_forming'],
  ['paint finish', 'paint_finish'],
  ['concrete work', 'concrete_work'],
  ['floor dry', 'floor_dry'],
  ['surface defect', 'surface_defect'],
]);

export function resolveInspectionTypeCode(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const raw = value.trim();
  const lower = raw.toLowerCase();
  if (INSPECTION_TYPE_ALIASES[lower]) return INSPECTION_TYPE_ALIASES[lower];
  if (INSPECTION_TYPE_ALIASES[raw]) return INSPECTION_TYPE_ALIASES[raw];
  const prefix = lower.split(/[\s—–-]/)[0];
  return INSPECTION_TYPE_ALIASES[prefix] ?? '';
}

export function resolveDomainCode(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const lower = value.trim().toLowerCase();
  return DOMAIN_ALIASES[lower] ?? '';
}

export function resolveSubjectCode(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const lower = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const underscored = value.trim().toLowerCase().replace(/\s+/g, '_');
  return SUBJECT_ALIASES[underscored] ?? SUBJECT_ALIASES[lower] ?? SUBJECT_ALIASES[value.trim().toLowerCase()] ?? '';
}

/** English display for VLM / non-UI contexts. Accepts codes or legacy labels. */
export function formatInspectionType(codeOrLabel: string | null | undefined): string {
  if (!codeOrLabel?.trim()) return '';
  const code = resolveInspectionTypeCode(codeOrLabel);
  if (code && INSPECTION_TYPE_LABELS[code]) return INSPECTION_TYPE_LABELS[code];
  return codeOrLabel.trim();
}

export function formatDomainLabelEn(codeOrLabel: string | null | undefined): string {
  if (!codeOrLabel?.trim()) return '';
  const code = resolveDomainCode(codeOrLabel);
  if (code && DOMAIN_LABELS_EN[code]) return DOMAIN_LABELS_EN[code];
  return codeOrLabel.trim();
}

export function formatSubjectLabelEn(codeOrLabel: string | null | undefined): string {
  if (!codeOrLabel?.trim()) return '';
  const code = resolveSubjectCode(codeOrLabel);
  if (code && SUBJECT_LABELS_EN[code]) return SUBJECT_LABELS_EN[code];
  return codeOrLabel.trim().replace(/_/g, ' ');
}

/** Localized display for UI (dividers, tags, tiles). */
export function formatClassifierLabel(
  kind: 'inspectionType' | 'domain' | 'subject',
  value: string | null | undefined,
  t: TFunction,
): string {
  if (!value?.trim()) return '';
  const raw = value.trim();

  if (kind === 'inspectionType') {
    const code = resolveInspectionTypeCode(raw);
    if (code) return t(`classifier.inspectionType.${code}`, { defaultValue: INSPECTION_TYPE_LABELS[code] ?? raw });
    return raw;
  }
  if (kind === 'domain') {
    const code = resolveDomainCode(raw);
    if (code) return t(`classifier.domain.${code}`, { defaultValue: DOMAIN_LABELS_EN[code] ?? raw });
    return raw;
  }
  const code = resolveSubjectCode(raw);
  if (code) return t(`classifier.subject.${code}`, { defaultValue: SUBJECT_LABELS_EN[code] ?? raw });
  return raw.replace(/_/g, ' ');
}

const topLabel = (out: ClassifierOutput, head: HeadName) => out[head][0]?.label ?? '';

/** Map ResNet heads → canonical codes (+ tags as codes). */
export function photoMetaFromClassifier(out: ClassifierOutput): PhotoClassifierMeta {
  const inspectionType = resolveInspectionTypeCode(topLabel(out, 'inspection_type')) || topLabel(out, 'inspection_type');
  const domain = resolveDomainCode(topLabel(out, 'domain')) || topLabel(out, 'domain');
  const subject = resolveSubjectCode(topLabel(out, 'subject')) || topLabel(out, 'subject');
  return {
    inspectionType,
    domain,
    subject,
    tags: buildPhotoTags(inspectionType, domain, subject),
  };
}

function normalizeTagKey(tag: string): string {
  const inspection = resolveInspectionTypeCode(tag);
  if (inspection) return `inspection:${inspection}`;
  const domain = resolveDomainCode(tag);
  if (domain) return `domain:${domain}`;
  const subject = resolveSubjectCode(tag);
  if (subject) return `subject:${subject}`;
  return tag
    .toLowerCase()
    .replace(/[—–-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preferCanonicalTag(tag: string): string {
  return (
    resolveInspectionTypeCode(tag) ||
    resolveDomainCode(tag) ||
    resolveSubjectCode(tag) ||
    tag.trim()
  );
}

function keysOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function isInspectionTypeTag(tag: string): boolean {
  return Boolean(resolveInspectionTypeCode(tag));
}

type ClassifierCore = {
  inspectionType?: string | null;
  domain?: string | null;
  subject?: string | null;
  labelHint?: string | null;
};

function coreTagKeys(core: ClassifierCore): string[] {
  return [core.inspectionType, core.labelHint, core.domain, core.subject]
    .map((value) => (value ? normalizeTagKey(preferCanonicalTag(value)) : ''))
    .filter(Boolean);
}

/** Keep only user-added tags; drop prior inspection type / domain / subject (and overlaps). */
export function extractCustomTags(
  tags: string[] | undefined,
  ...cores: ClassifierCore[]
): string[] {
  if (!tags?.length) return [];
  const blocked = cores.flatMap((core) => coreTagKeys(core));

  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      if (isInspectionTypeTag(tag)) return false;
      const key = normalizeTagKey(tag);
      return !blocked.some((blockedKey) => keysOverlap(key, blockedKey));
    });
}

/** Drop exact / overlapping duplicates across classifier fields and extras. Prefer canonical codes. */
export function dedupeOverlappingTags(tags: string[]): string[] {
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean);
  const kept: string[] = [];

  for (const raw of cleaned) {
    const tag = preferCanonicalTag(raw);
    const key = normalizeTagKey(tag);
    if (!key) continue;

    const overlapIndex = kept.findIndex((existing) =>
      keysOverlap(normalizeTagKey(existing), key),
    );

    if (overlapIndex < 0) {
      kept.push(tag);
      continue;
    }

    // Prefer canonical classifier codes over free-text duplicates.
    const existing = kept[overlapIndex];
    const existingCanonical = preferCanonicalTag(existing);
    if (existingCanonical !== existing && tag === existingCanonical) {
      kept[overlapIndex] = tag;
    } else if (tag.length > existing.length) {
      kept[overlapIndex] = tag;
    }
  }

  return kept;
}

export function buildPhotoTags(
  inspectionType?: string | null,
  domain?: string | null,
  subject?: string | null,
  extra: string[] = [],
): string[] {
  const core = [
    resolveInspectionTypeCode(inspectionType) || inspectionType,
    resolveDomainCode(domain) || domain,
    resolveSubjectCode(subject) || subject,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return dedupeOverlappingTags([...core, ...extra]);
}

export function formatPhotoTag(tags: string[] | undefined, t?: TFunction): string {
  if (!tags?.length) return '';
  if (!t) {
    return tags
      .map((tag) => formatInspectionType(tag) || formatDomainLabelEn(tag) || formatSubjectLabelEn(tag) || tag)
      .join(' · ');
  }
  return tags
    .map((tag) => {
      if (resolveInspectionTypeCode(tag)) return formatClassifierLabel('inspectionType', tag, t);
      if (resolveDomainCode(tag)) return formatClassifierLabel('domain', tag, t);
      if (resolveSubjectCode(tag)) return formatClassifierLabel('subject', tag, t);
      return tag;
    })
    .join(' · ');
}

/** Prefer classifier fields so Tag always includes inspection type + domain + subject. */
export function resolvePhotoTags(meta: {
  tags?: string[];
  inspectionType?: string;
  domain?: string;
  subject?: string;
  /** Legacy field from older queue items. */
  labelHint?: string;
  /** Prior classifier fields to strip from tags when refreshing after re-assess. */
  previous?: ClassifierCore;
}): string[] {
  const inspectionType =
    resolveInspectionTypeCode(meta.inspectionType ?? meta.labelHint) ||
    meta.inspectionType?.trim() ||
    meta.labelHint?.trim() ||
    '';
  const domain = resolveDomainCode(meta.domain) || meta.domain?.trim() || '';
  const subject = resolveSubjectCode(meta.subject) || meta.subject?.trim() || '';
  const custom = extractCustomTags(
    meta.tags,
    {
      inspectionType: meta.inspectionType ?? meta.labelHint,
      domain: meta.domain,
      subject: meta.subject,
    },
    meta.previous ?? {},
  );
  return buildPhotoTags(inspectionType, domain, subject, custom);
}
