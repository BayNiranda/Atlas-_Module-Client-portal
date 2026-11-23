// Public contact details shown on the website.
// Trial number from the owner (20 Nov 2026). Email: none yet, so it is hidden.
export const site = {
  whatsappNumber: "8562058220272", // digits only, international format
  whatsappDisplay: "+856 20 5822 0272",
  email: "", // empty = not shown
  city: "Vientiane, Lao PDR",
};

export function waLink(message: string) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
