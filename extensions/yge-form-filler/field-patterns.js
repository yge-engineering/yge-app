// YGE Form Filler — known agency-form field patterns.
//
// Maps a likely-input element to the YGE master-profile field
// it should be filled from. Matching is loose: we scan the
// field's name, id, aria-label, and the nearest <label> text
// for any of the patterns. First match wins.
//
// Today this module is read by the content script to report
// what it COULD fill if auto-fill were on. The actual fill
// flow lands in a follow-up bundle.

// Each entry: a profile-path key + an array of substring or
// regex patterns. Patterns are case-insensitive; substrings
// match anywhere in the haystack.
export const FIELD_PATTERNS = [
  {
    profilePath: 'legalName',
    patterns: [
      'company name',
      'company_name',
      'companyname',
      'firm name',
      'contractor name',
      'legal name',
      'business name',
      'bidder name',
      'organization name',
      'entity name',
      'vendor name',
      'corporate name',
      'name of contractor',
      'name of firm',
      'name of bidder',
    ],
  },
  {
    profilePath: 'cslbLicense',
    patterns: [
      'cslb',
      'license number',
      'license_no',
      'licenseno',
      'cslb license',
      'contractor license',
      'state license',
      'lic. no',
      'lic no',
      'lic number',
      'contractor\'s license',
    ],
  },
  {
    profilePath: 'dirNumber',
    patterns: [
      'dir number',
      'dir_no',
      'dir registration',
      'public works registration',
      'pwcr',
      'dir #',
      'dir id',
      'department of industrial relations',
    ],
  },
  {
    profilePath: 'dotNumber',
    patterns: [
      'dot number',
      'usdot',
      'us_dot',
      'mc number',
      'motor carrier',
      'usdot #',
      'dot #',
    ],
  },
  {
    profilePath: 'federalEin',
    patterns: [
      'ein',
      'fein',
      'federal id',
      'federal_id',
      'tax id',
      'employer identification',
      'tin',
      'taxpayer id',
      'federal tax id',
    ],
  },
  {
    profilePath: 'address.street',
    patterns: [
      'street address',
      'address line 1',
      'address1',
      'street1',
      'mailing street',
      'business address',
      'mailing address',
      'address (street)',
      'physical address',
    ],
  },
  {
    profilePath: 'address.city',
    patterns: ['city', 'city name', 'city/town'],
  },
  {
    profilePath: 'address.state',
    patterns: ['state', 'state abbr', 'state code', 'st '],
  },
  {
    profilePath: 'address.zip',
    patterns: ['zip', 'zip code', 'postal code', 'zipcode', 'zip+4'],
  },
  {
    profilePath: 'primaryPhone',
    patterns: [
      'phone',
      'phone number',
      'telephone',
      'office phone',
      'tel',
      'tel:',
      'tel.',
      'business phone',
      'contact phone',
      'main phone',
      'work phone',
    ],
  },
  {
    profilePath: 'primaryEmail',
    patterns: [
      'email',
      'email address',
      'e-mail',
      'e mail',
      'contact email',
      'business email',
    ],
  },
  {
    profilePath: 'officers.president.name',
    patterns: ['president name', 'president', 'ceo', 'principal'],
  },
  {
    profilePath: 'officers.vp.name',
    patterns: [
      'vice president',
      'vp name',
      'authorized signer',
      'authorized representative',
      'signer name',
      'signature name',
      'printed name',
      'name (printed)',
    ],
  },
  {
    profilePath: 'naicsCodes',
    patterns: [
      'naics',
      'naics code',
      'naics number',
      'naics classification',
      'primary naics',
    ],
  },
  {
    profilePath: 'pscCodes',
    patterns: [
      'psc code',
      'product service code',
      'product or service code',
    ],
  },
  {
    profilePath: 'websiteUrl',
    patterns: [
      'website',
      'web site',
      'website url',
      'website address',
      'web address',
      'company website',
      'firm website',
    ],
  },
  {
    profilePath: 'caMcpNumber',
    patterns: [
      'ca mcp',
      'mcp number',
      'motor carrier permit',
      'mcp #',
    ],
  },
  {
    profilePath: 'caEntityNumber',
    patterns: [
      'ca sos',
      'sos entity',
      'secretary of state entity',
      'ca entity',
      'sos number',
    ],
  },
];

/** Given the assorted text labels for a field, return the
 *  profile-path that should fill it — or null when no pattern
 *  matches. */
export function classifyField({ name, id, ariaLabel, labelText }) {
  const haystack = [name, id, ariaLabel, labelText]
    .filter((s) => typeof s === 'string' && s.length > 0)
    .join(' | ')
    .toLowerCase();
  if (haystack.length === 0) return null;
  for (const entry of FIELD_PATTERNS) {
    for (const p of entry.patterns) {
      if (haystack.includes(p)) return entry.profilePath;
    }
  }
  return null;
}
