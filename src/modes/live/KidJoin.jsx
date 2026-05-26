import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { breakers, glitches, skillNames } from "../../gameData.js";

const TOKEN_KEY = "tlv_session";
const ALL = [...breakers, ...glitches];
const cardFor = (id) => ALL.find((c) => c.id === id);

function MemberCards({ members }) {
  return (
    <div className="lineupCards">
      {members.map((m, i) => {
        const c = cardFor(m.characterId);
        return (
          <article key={i} className={`lineupCard ${m.role === "glitch" ? "glitchPick" : "breakerPick"}`}>
            {c ? <img src={c.img} alt="" /> : <div className="lineupCard__blank" />}
            <div>
              <strong>{m.handle}</strong>
              <span>{c ? c.name : "choosing…"}{m.role === "glitch" ? " · Glitch" : ""}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

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

  // ---- in a team ----
  if (view) {
    const taken = new Set(view.members.map((m) => m.characterId).filter(Boolean));
    const need = Math.max(0, 3 - view.members.length);
    return (
      <section className="liveTeam">
        <div className="liveTeamHead">
          <h2>{view.name}</h2>
          <span className={view.locked ? "lockPill on" : "lockPill"}>{view.locked ? "🔒 Locked — get ready!" : `${view.members.length} in lobby`}</span>
        </div>

        <MemberCards members={view.members} />

        {!view.locked && (
          <>
            <h3>Pick your Breaker</h3>
            <div className="pickerGrid">
              {breakers.map((c) => (
                <button key={c.id}
                  className={view.me.characterId === c.id ? "selected pick" : "pick"}
                  disabled={taken.has(c.id) && view.me.characterId !== c.id}
                  onClick={() => run(() => pick({ sessionToken: token, characterId: c.id, role: "breaker" }))}>
                  <img src={c.img} alt="" />
                  <span>{c.name}<small>{skillNames[c.skill]}</small></span>
                </button>
              ))}
            </div>
            {view.glitchMode === "kid" && (
              <>
                <h3>…or be the Glitch</h3>
                <div className="pickerGrid three">
                  {glitches.map((c) => (
                    <button key={c.id}
                      className={view.me.characterId === c.id ? "selected pick" : "pick glitchPick"}
                      disabled={taken.has(c.id) && view.me.characterId !== c.id}
                      onClick={() => run(() => pick({ sessionToken: token, characterId: c.id, role: "glitch" }))}>
                      <img src={c.img} alt="" />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {view.youAreCaptain && (
              <button className="startButton lockBtn" disabled={need > 0}
                onClick={() => run(() => lock({ sessionToken: token, teamId: view.teamId }))}>
                {need > 0 ? `Lock Team — need ${need} more` : "Lock Team"}
              </button>
            )}
            {!view.youAreCaptain && <p className="small">Waiting for the captain to lock the team…</p>}
          </>
        )}
        {err && <p className="err">{err}</p>}
        <button className="secondary" onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); }}>Leave team</button>
      </section>
    );
  }

  // ---- joining ----
  return (
    <section className="kidJoin">
      <p className="eyebrow">Join the mainframe</p>
      <h2>Enter your class</h2>
      <input className="codeInput" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CLASS CODE" maxLength={5} />
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your handle" maxLength={16} />
      {code.length === 5 && (
        <div className="teamGrid joinGrid">
          {(teams ?? []).map((t) => (
            <button key={t.teamId} className={`teamPanel joinable ${t.locked ? "locked" : ""}`}
              disabled={t.locked || !handle.trim()}
              onClick={async () => { const r = await run(() => joinTeam({ code, teamId: t.teamId, handle })); if (r) setToken(r.sessionToken); }}>
              <h3>{t.name} {t.locked ? "🔒" : ""}</h3>
              <span>{t.count} player{t.count === 1 ? "" : "s"}</span>
            </button>
          ))}
          <button className="teamPanel newTeam" disabled={!handle.trim()}
            onClick={async () => { const r = await run(() => joinClass({ code, handle, teamName: `${handle}'s team` })); if (r) setToken(r.sessionToken); }}>
            <h3>+ New team</h3>
            <span>start your own</span>
          </button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </section>
  );
}
