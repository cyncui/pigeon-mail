/**
 * A postal address, structured to map 1:1 onto Lob's `to` / `from` objects so
 * the future real send is a straight field rename (name → name, line1 →
 * address_line1, …). Until the backend lands this is purely client-side.
 */
export type Address = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  /** ISO-2 country code; defaults to 'US'. */
  country: string;
};

export const EMPTY_ADDRESS: Address = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

/** The fields Lob requires to mail a card; line2 is optional. */
export function isAddressComplete(a: Address): boolean {
  return [a.name, a.line1, a.city, a.state, a.zip].every((field) => field.trim().length > 0);
}

/**
 * Tolerant parse of a handwritten "City, ST ZIP" line (Postel's law — messy in,
 * Lob-clean out). Returns null until the line is complete enough to mail.
 */
export function parseCityLine(line: string): { city: string; state: string; zip: string } | null {
  const match = line.trim().match(/^(.+?),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return null;
  return { city: match[1].trim(), state: match[2].toUpperCase(), zip: match[3] };
}

/** The display form of city/state/zip as one handwritten line. */
export function formatCityLine(a: Pick<Address, 'city' | 'state' | 'zip'>): string {
  const stateZip = [a.state.trim(), a.zip.trim()].filter(Boolean).join(' ');
  return [a.city.trim(), stateZip].filter(Boolean).join(', ');
}

/**
 * Address as stacked lines for the handwritten display on the card back and the
 * send preview, e.g. ['Jane Doe', '123 Main St', 'Apt 4', 'Portland, OR 97201'].
 * The country line is dropped for US mail to keep the domestic look clean.
 */
export function formatAddressLines(a: Address): string[] {
  const lines: string[] = [];
  if (a.name.trim()) lines.push(a.name.trim());
  if (a.line1.trim()) lines.push(a.line1.trim());
  if (a.line2?.trim()) lines.push(a.line2.trim());

  const stateZip = [a.state.trim(), a.zip.trim()].filter(Boolean).join(' ');
  const cityLine = [a.city.trim(), stateZip].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);

  const country = a.country.trim().toUpperCase();
  if (country && country !== 'US' && country !== 'USA') lines.push(country);

  return lines;
}
