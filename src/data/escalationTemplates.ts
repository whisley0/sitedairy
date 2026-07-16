export interface EscalationTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
}

export const CUSTOM_ESCALATION_TEMPLATE_ID = 'custom';

export const ESCALATION_TEMPLATES: EscalationTemplate[] = [
  {
    id: 'no-crew',
    label: 'No crew on site',
    title: 'No crew on site',
    description: 'Only minimal workers present; critical path work is stalled and needs management support.',
  },
  {
    id: 'severe-weather',
    label: 'Severe weather',
    title: 'Severe weather stop-work',
    description:
      'Unsafe weather conditions on site. Work halted until conditions improve and management confirms restart.',
  },
  {
    id: 'safety-incident',
    label: 'Safety incident',
    title: 'Safety incident on site',
    description:
      'A safety incident has occurred requiring immediate management review and follow-up actions.',
  },
  {
    id: CUSTOM_ESCALATION_TEMPLATE_ID,
    label: 'Custom',
    title: '',
    description: '',
  },
];

export function getEscalationTemplate(id: string | null): EscalationTemplate | undefined {
  if (!id) return undefined;
  return ESCALATION_TEMPLATES.find((template) => template.id === id);
}
