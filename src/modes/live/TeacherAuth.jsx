import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function TeacherAuth({ children }) {
  const { signIn } = useAuthActions();
  const access = useQuery(api.access.myAccess);
  const redeem = useMutation(api.access.redeemCode);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  if (access === undefined) return <p className="liveMsg">Loading…</p>;

  if (access === null) {
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

  if (!access.hasLiveAccess) {
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

  return children;
}
