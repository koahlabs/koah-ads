import Link from "next/link";

export function BrandLink() {
  return (
    <span className="brand-link">
      <a className="brand-koah-link" href="https://www.koahlabs.com/" aria-label="Visit Koah Labs">
        {/* Official Koah symbol from koahlabs.com/images/koah.svg. */}
        <svg className="koah-mark" width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M0 0H6.95397L9.74023 9.81989L6.95397 19.6398H0V0Z" />
          <path d="M12.5265 0H19.4805V7.22231L9.74023 9.81986L12.5265 0Z" />
          <path d="M12.5265 19.6392H19.4805V12.4169L9.74023 9.8193L12.5265 19.6392Z" />
        </svg>
      </a>
      <span className="brand-divider" aria-hidden="true" />
      <Link href="/" aria-label="Sidequest home">sidequest</Link>
    </span>
  );
}
