import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";

function SignIn() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  return (
    <div className="teacherAuth">
      <h2>Teacher sign-in</h2>
      <button className="startButton" onClick={() => signIn("google")}>Sign in with Google</button>
      <form onSubmit={(e) => { e.preventDefault(); signIn("resend", { email }); }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" type="email" />
        <button type="submit" className="secondary">Email me a magic link</button>
      </form>
    </div>
  );
}

function AccessGate({ children }) {
  const access = useQuery(api.access.myAccess);
  const redeem = useMutation(api.access.redeemCode);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  if (access === undefined) return <p className="liveMsg">Loading…</p>;
  if (access.hasLiveAccess) return children;
  return (
    <div className="teacherAuth">
      <h2>Enter your PDF access code</h2>
      <p className="small">It's printed on the rules page of your download.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LASTVAR-S1-XXXX" />
      <button className="startButton" onClick={async () => { setErr(""); try { await redeem({ code }); } catch (e) { setErr(String(e.message || e)); } }}>Unlock</button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function TeacherAuth({ children }) {
  return (
    <>
      <AuthLoading><p className="liveMsg">Loading…</p></AuthLoading>
      <Unauthenticated><SignIn /></Unauthenticated>
      <Authenticated><AccessGate>{children}</AccessGate></Authenticated>
    </>
  );
}
