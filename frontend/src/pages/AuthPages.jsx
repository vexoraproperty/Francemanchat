import { SignIn, SignUp } from "@clerk/react";
import { Link } from "react-router-dom";
import { LogoMark, Wordmark } from "@/components/Brand";

function Shell({ children }) {
  return (
    <div className="flex min-h-screen bg-[#fafaf7]" data-testid="auth-page">
      <aside className="hidden w-[44%] flex-col justify-between bg-[#0e241a] p-12 text-[#f3f1ea] lg:flex">
        <Link to="/" className="flex items-center gap-3"><LogoMark size={40} /><Wordmark inverse sub="Support desk" /></Link>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a6b1a7]">§ Staff access</div>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight">Every buyer conversation, in one place.</h1>
          <p className="mt-4 max-w-md text-sm text-[#a6b1a7]">Reply to website visitors in real time, see where they are and what they are reading, and keep the export desk responsive across time zones.</p>
        </div>
        <p className="text-xs text-[#a6b1a7]">Franceman Exportation LLP</p>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <Link to="/" className="flex items-center gap-3 lg:hidden"><LogoMark size={36} /><Wordmark /></Link>
        {children}
      </main>
    </div>
  );
}

export const SignInPage = () => <Shell><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></Shell>;
export const SignUpPage = () => <Shell><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></Shell>;
