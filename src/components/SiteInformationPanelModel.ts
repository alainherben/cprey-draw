import type { SiteInformation } from '../types/project';

export type SiteDraft = Required<SiteInformation>;

export const EMPTY_SITE_DRAFT: SiteDraft = {
  name: '',
  reference: '',
  quoteReference: '',
  clientName: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  builder: '',
  electrician: '',
  distributor: '',
  projectVersion: '',
  comments: '',
};

export function toSiteDraft(site: Partial<SiteInformation> | undefined): SiteDraft {
  return {
    name: site?.name ?? '',
    reference: site?.reference ?? '',
    quoteReference: site?.quoteReference ?? '',
    clientName: site?.clientName ?? '',
    address: site?.address ?? '',
    postalCode: site?.postalCode ?? '',
    city: site?.city ?? '',
    phone: site?.phone ?? '',
    email: site?.email ?? '',
    builder: site?.builder ?? '',
    electrician: site?.electrician ?? '',
    distributor: site?.distributor ?? '',
    projectVersion: site?.projectVersion ?? '',
    comments: site?.comments ?? '',
  };
}

export function fromSiteDraft(draft: Partial<SiteDraft>): SiteInformation {
  return {
    name: cleanOptionalText(draft.name),
    reference: cleanOptionalText(draft.reference),
    quoteReference: cleanOptionalText(draft.quoteReference),
    clientName: cleanOptionalText(draft.clientName),
    address: cleanOptionalText(draft.address),
    postalCode: cleanOptionalText(draft.postalCode),
    city: cleanOptionalText(draft.city),
    phone: cleanOptionalText(draft.phone),
    email: cleanOptionalText(draft.email),
    builder: cleanOptionalText(draft.builder),
    electrician: cleanOptionalText(draft.electrician),
    distributor: cleanOptionalText(draft.distributor),
    projectVersion: cleanOptionalText(draft.projectVersion),
    comments: cleanOptionalText(draft.comments),
  };
}

export function cleanOptionalText(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed || undefined;
}
