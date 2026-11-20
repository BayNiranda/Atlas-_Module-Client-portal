// Line icons from the prototype.
const SERVICE_PATHS: Record<string, React.ReactNode> = {
  accounting: (<><path d="M5 3h14v18H5z" /><path d="M8 7h8M8 11h8M8 15h5" /></>),
  advisory: <path d="M4 19V9M10 19V5M16 19v-7M3 21h18" />,
  startup: (<><path d="M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9z" /><path d="M9 15l-2 4 3-1M15 15l2 4-3-1" /><circle cx="12" cy="10" r="1.6" /></>),
  improvement: (<><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>),
};

const VALUE_PATHS = {
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  cal: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 15l2.5 2.5L16 13" /></>),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  lock: (<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const ServiceIcon = ({ slug }: { slug: string }) => <Svg>{SERVICE_PATHS[slug] ?? SERVICE_PATHS.accounting}</Svg>;
export const ValueIcon = ({ name }: { name: keyof typeof VALUE_PATHS }) => <Svg>{VALUE_PATHS[name]}</Svg>;

export function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8C29 8.7 23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.9-3.9-1.9-6.1C4.9 9.8 9.9 5 16 5s11.1 4.8 11.1 10.8S22.1 26.4 16 26.4zm6.1-8c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.1 2.9 1.1 3.5.9 4.1.8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z" />
    </svg>
  );
}
