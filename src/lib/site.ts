// Public contact details shown on the website.
// TO CONFIRM: placeholders until the owner provides the real WhatsApp number and email.
export const site = {
  whatsappNumber: "8562000000000", // digits only, international format
  whatsappDisplay: "+856 20 0000 0000",
  email: "info@atlas-advisory.example",
  city: "Vientiane, Lao PDR",
};

export function waLink(message: string) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
