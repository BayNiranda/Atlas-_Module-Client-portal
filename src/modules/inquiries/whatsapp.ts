// wa.me needs the international number. Lao numbers are often written locally
// ("020 5555 0101"), so a leading 0 becomes Laos' country code 856.
export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `856${digits.slice(1)}` : digits;
}

export const waTo = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
