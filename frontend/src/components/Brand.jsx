export const LogoMark = ({ size = 36, className = "" }) => (
  <div aria-hidden className={`shrink-0 rounded-full bg-white ring-1 ring-black/5 ${className}`}
    style={{ width: size, height: size, backgroundImage: "url(/franceman-logo.jpg)", backgroundSize: "270%", backgroundPosition: "50% 30%" }} />
);

export const Wordmark = ({ inverse = false, sub = "Exportation LLP" }) => (
  <div className="leading-none">
    <div className={`text-[15px] font-semibold tracking-[0.14em] ${inverse ? "text-[#f3f1ea]" : "text-[#104e35]"}`}>FRANCEMAN</div>
    <div className={`mt-1 text-[10px] font-medium uppercase tracking-[0.22em] ${inverse ? "text-[#a6b1a7]" : "text-[#4b554d]"}`}>{sub}</div>
  </div>
);
