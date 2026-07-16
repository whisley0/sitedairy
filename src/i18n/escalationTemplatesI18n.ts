import type { TFunction } from 'i18next';
import {
  CUSTOM_ESCALATION_TEMPLATE_ID,
  type EscalationTemplate,
} from '../data/escalationTemplates';

const TEMPLATE_KEYS = {
  'no-crew': {
    label: 'escalation.templates.noCrewLabel',
    title: 'escalation.templates.noCrewTitle',
    description: 'escalation.templates.noCrewDescription',
  },
  'severe-weather': {
    label: 'escalation.templates.severeWeatherLabel',
    title: 'escalation.templates.severeWeatherTitle',
    description: 'escalation.templates.severeWeatherDescription',
  },
  'safety-incident': {
    label: 'escalation.templates.safetyIncidentLabel',
    title: 'escalation.templates.safetyIncidentTitle',
    description: 'escalation.templates.safetyIncidentDescription',
  },
  [CUSTOM_ESCALATION_TEMPLATE_ID]: {
    label: 'escalation.templates.customLabel',
    title: '',
    description: '',
  },
} as const;

export function getLocalizedEscalationTemplates(t: TFunction): EscalationTemplate[] {
  return Object.entries(TEMPLATE_KEYS).map(([id, keys]) => ({
    id,
    label: t(keys.label),
    title: keys.title ? t(keys.title) : '',
    description: keys.description ? t(keys.description) : '',
  }));
}

export { CUSTOM_ESCALATION_TEMPLATE_ID };
