import { useEffect, useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Brand";
import { ChatWidget } from "@/components/widget/ChatWidget";

const PRODUCTS = [
  { name: "Kola Nut", origin: "Ogun · Osun · Oyo", moq: "500 kg", img: "/site/kolanut.webp" },
  { name: "Bitter Kola", origin: "Cross River · Edo · Delta", moq: "300 kg", img: "/site/bitter-kola.jpg" },
  { name: "Ginger", origin: "Kaduna (Kachia · Jaba)", moq: "1,000 kg", img: "/site/ginger.jpg" },
  { name: "Turmeric", origin: "Plateau · Nasarawa · Benue", moq: "1,000 kg", img: "/site/turmeric.jpg" },
  { name: "Hibiscus", origin: "Jigawa · Katsina · Kano", moq: "1,000 kg", img: "/site/hibiscus.jpeg" },
  { name: "Sesame", origin: "Benue · Nasarawa · Jigawa", moq: "5,000 kg", img: "/site/sesame.jpg" },
  { name: "Raw Cashew Nuts", origin: "Kwara · Kogi · Oyo", moq: "5,000 kg", img: "/site/cashew.webp" },
];

const PAGES = {
  "/": "Franceman Exportation LLP | Export-Ready Nigerian Agricultural Products",
  "/products": "Products | Franceman Exportation LLP",
  "/sample-request": "Request a sample | Franceman Exportation LLP",
  "/contact": "Contact | Franceman Exportation LLP",
};

function SiteHeader() {
  const link = ({ isActive }) => `text-sm transition-colors ${isActive ? "text-[#104e35] font-medium" : "text-[#4b554d] hover:text-[#104e35]"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-[#dfddd8] bg-[#fafaf7]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
        <Link to="/" className="flex items-center gap-3" data-testid="site-logo-link"><LogoMark size={36} /><Wordmark /></Link>
        <nav className="ml-auto hidden items-center gap-7 md:flex">
          <NavLink to="/products" className={link} data-testid="site-nav-products">Products</NavLink>
          <NavLink to="/sample-request" className={link} data-testid="site-nav-sample">Samples</NavLink>
          <NavLink to="/contact" className={link} data-testid="site-nav-contact">Contact</NavLink>
        </nav>
        <Link to="/inbox" className="ml-auto rounded-md border border-[#104e35] px-3.5 py-2 text-sm font-medium text-[#104e35] transition-colors hover:bg-[#104e35] hover:text-white md:ml-0" data-testid="site-staff-login-link">
          <span className="whitespace-nowrap"><span className="hidden sm:inline">Support team </span><span className="sm:hidden">Staff </span>login</span>
        </Link>
      </div>
      <nav className="flex gap-6 border-t border-[#efede8] px-5 py-2.5 md:hidden" data-testid="site-mobile-nav">
        <NavLink to="/products" className={link}>Products</NavLink>
        <NavLink to="/sample-request" className={link}>Samples</NavLink>
        <NavLink to="/contact" className={link}>Contact</NavLink>
      </nav>
    </header>
  );
}

function ProductGrid({ limit }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PRODUCTS.slice(0, limit).map((p, i) => (
        <article key={p.name} className="group overflow-hidden rounded-lg border border-[#dfddd8] bg-white" data-testid={`site-product-${i}`}>
          <div className="aspect-[4/3] overflow-hidden bg-[#f1f0ec]"><img src={p.img} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /></div>
          <div className="p-4">
            <div className="fm-eyebrow">N°{String(i + 1).padStart(2, "0")}</div>
            <h3 className="mt-1 text-base font-semibold">{p.name}</h3>
            <p className="mt-1 text-xs text-[#4b554d]">{p.origin} · MOQ {p.moq}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div>
          <div className="fm-eyebrow">Nigeria / Worldwide · Fresh origin. Clear route.</div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-[#121713] sm:text-5xl lg:text-6xl">Products that move with purpose.</h1>
          <p className="mt-6 max-w-lg text-base text-[#4b554d]">Nigerian agricultural commodities prepared for buyers who value consistency. Ask our export desk anything using the chat in the corner.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products" className="inline-flex items-center gap-2 rounded-md bg-[#104e35] px-5 py-3 text-sm font-medium text-white hover:bg-[#03402a]" data-testid="site-hero-products-button">Explore products <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/sample-request" className="rounded-md border border-[#dfddd8] bg-white px-5 py-3 text-sm font-medium hover:border-[#104e35]" data-testid="site-hero-sample-button">Request a sample</Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#dfddd8]"><img src="/site/sacks.png" alt="Franceman export sacks" className="h-full max-h-[460px] w-full object-cover" /></div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-6 flex items-end justify-between"><div><div className="fm-eyebrow">§ 01 — Buyer directory</div><h2 className="mt-2 text-lg font-semibold">Find the right crop for your next shipment.</h2></div>
          <Link to="/products" className="text-sm text-[#104e35] hover:underline">Full catalogue →</Link></div>
        <ProductGrid limit={4} />
      </section>
    </>
  );
}

const Simple = ({ eyebrow, title, body, children }) => (
  <section className="mx-auto max-w-6xl px-5 py-16">
    <div className="fm-eyebrow">{eyebrow}</div>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
    <p className="mt-4 max-w-xl text-base text-[#4b554d]">{body}</p>
    <div className="mt-10">{children}</div>
  </section>
);

export default function SiteDemo() {
  const { pathname } = useLocation();
  const title = PAGES[pathname] || PAGES["/"];
  useEffect(() => { document.title = title; }, [title]);
  const page = useMemo(() => ({ url: window.location.href, title, referrer: document.referrer }), [pathname, title]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#121713]" data-testid="site-demo">
      <SiteHeader />
      {pathname === "/products" ? (
        <Simple eyebrow="§ 02 — Export range" title="Our export range." body="Origin, minimum order and availability for each crop. Prices are on request."><ProductGrid /></Simple>
      ) : pathname === "/sample-request" ? (
        <Simple eyebrow="§ 03 — Try first" title="Request a 500g — 2kg sample." body="Shipped DHL Express within 48 hours of confirmation, with a lab certificate and origin record. Open the chat to request one." />
      ) : pathname === "/contact" ? (
        <Simple eyebrow="§ 07 — Get in touch" title="Send the spec. We'll send the offer." body="Tell us the product, the port and the volume. You'll have a quotation in your inbox within one business day." />
      ) : <Home />}
      <footer className="border-t border-[#dfddd8] py-8 text-center text-xs text-[#6b746c]">Franceman Exportation LLP · Asaba, Delta State, Nigeria</footer>
      <ChatWidget page={page} />
    </div>
  );
}
