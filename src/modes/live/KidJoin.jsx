import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { breakers, glitches } from "../../gameData.js";

const TOKEN_KEY = "tlv_session";

export function KidJoin() {
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [err, setErr] = useState("");
  const teams = useQuery(api.teams.teamsInClass, code.length === 5 ? { code } : "skip");
  const view = useQuery(api.teams.teamView, token ? { sessionToken: token } : "skip");
  const joinClass = useMutation(api.teams.joinClass);
  const joinTeam = useMutation(api.teams.joinTeam);
  const pick = useMutation(api.teams.pickCharacter);
  const lock = useMutation(api.teams.lockTeam);

  useEffect(() => { if (token) localStorage.setItem(TOKEN_KEY, token); }, [token]);

  async function run(fn) { setErr(""); try { return await fn(); } catch (e) { setErr(String(e.message || e)); } }

  if (view) {
    const takenChars = new Set(view.members.map((m) => m.characterId).filter(Boolean));
    return (
      <div className="kidTeam">
        <h2>{view.name} {view.locked ? "🔒 locked — get ready!" : ""}</h2>
        <ul className="memberList">
          {view.members.map((m, i) => <li key={i}>{m.handle}{m.characterId ? ` · ${m.characterId}` : ""}{m.role === "glitch" ? " (Glitch)" : ""}</li>)}
        </ul>
        {!view.locked && (
          <>
            <div className="charPick">
              {breakers.map((c) => (
                <button key={c.id} disabled={takenChars.has(c.id) && view.me.characterId !== c.id}
                  className={view.me.characterId === c.id ? "selected" : ""}
                  onClick={() => run(() => pick({ sessionToken: token, characterId: c.id, role: "breaker" }))}>{c.name}</button>
              ))}
              {view.glitchMode === "kid" && glitches.map((c) => (
                <button key={c.id} onClick={() => run(() => pick({ sessionToken: token, characterId: c.id, role: "glitch" }))}>{c.name} (Glitch)</button>
              ))}
            </div>
            {view.youAreCaptain && <button className="startButton" onClick={() => run(() => lock({ sessionToken: token, teamId: view.teamId }))}>Lock Team</button>}
          </>
        )}
        {err && <p className="err">{err}</p>}
        <button className="secondary" onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); }}>Leave</button>
      </div>
    );
  }

  return (
    <div className="kidJoin">
      <h2>Join a class</h2>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CLASS CODE" maxLength={5} />
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your handle" maxLength={16} />
      {code.length === 5 && (
        <div className="teamList">
          {(teams ?? []).filter((t) => !t.locked).map((t) => (
            <button key={t.teamId} disabled={!handle.trim()}
              onClick={async () => { const r = await run(() => joinTeam({ code, teamId: t.teamId, handle })); if (r) setToken(r.sessionToken); }}>
              Join {t.name} ({t.count})
            </button>
          ))}
          <button className="startButton" disabled={!handle.trim()}
            onClick={async () => { const r = await run(() => joinClass({ code, handle, teamName: `${handle}'s team` })); if (r) setToken(r.sessionToken); }}>
            + Start a new team
          </button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
