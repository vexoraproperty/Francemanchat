import { SignIn, SignUp } from "@clerk/react";
import { LogoMark } from "@/components/Brand";

const STATS = [["48h", "Sample dispatch"], ["24h", "Quote turnaround"], ["ISO", "22000 certified"]];

function Shell({ title, sub, children }) {
  return (
    <div className="flex min-h-screen bg-[#fafaf7]" data-testid="auth-page">
      <aside className="hidden w-1/2 flex-col justify-between bg-[#0c1c15] p-10 text-[#f3f1ea] lg:flex">
        <div className="flex items-center gap-3"><LogoMark size={36} /><span className="text-sm font-medium">Franceman Exportation LLP</span></div>
        <div>
          <div className="fm-mono-eyebrow !text-[#6ee7a8]">§ 01 — Export desk</div>
          <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05]">Fresh origin.<br />Clear route.</h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[#a6b1a7]">The support workspace for buyer conversations, quotations and shipment follow-up — from first enquiry to final port.</p>
        </div>
        <div className="grid grid-cols-3 border-t border-[#27362e] pt-6">
          {STATS.map(([v, l]) => <div key={l}><div className="font-mono text-lg">{v}</div><div className="mt-1 text-xs text-[#a6b1a7]">{l}</div></div>)}
        </div>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-3 lg:hidden"><LogoMark size={36} /><span className="text-sm font-medium text-[#104e35]">Franceman Exportation LLP</span></div>
          <div className="fm-mono-eyebrow">N°00 / Team access</div>
          <h2 className="font-display mt-2 text-4xl font-semibold text-[#104e35]">{title}</h2>
          <p className="mt-1 text-sm text-[#4b554d]">{sub}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export const SignInPage = () => (
  <Shell title="Sign in to the support desk" sub="For Franceman agents, supervisors and administrators.">
    <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
  </Shell>
);
export const SignUpPage = () => (
  <Shell title="Join the support desk" sub="An administrator approves new accounts before they can see conversations.">
    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
  </Shell>
);
