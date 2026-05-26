import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { breakers, glitches } from "../../gameData.js";

const ALL = [...breakers, ...glitches];
const cardFor = (id) => ALL.find((c) => c.id === id);

export function TeacherClass() {
  const open = useMutation(api.classes.openClass);
  const end = useMutation(api.classes.endClass);
  const [cls, setCls] = useState(null);
  const dash = useQuery(api.classes.classDashboard, cls ? { classId: cls.classId } : "skip");

  if (!cls) {
    return (
      <div className="teacherStart">
        <p className="eyebrow">Classroom mode</p>
        <h2>Start a class, put the code on the board</h2>
        <button className="startButton" onClick={async () => setCls(await open({}))}>Start Class</button>
      </div>
    );
  }

  const teams = dash?.teams ?? [];
  const lockedCount = teams.filter((t) => t.locked).length;
  return (
    <div className="dashboard">
      <header className="dashHead">
        <div>
          <p className="eyebrow">Students join at the-last-variable.vercel.app with code</p>
          <b className="classCode">{cls.code}</b>
        </div>
        <div className="dashStats">
          <span>{teams.length} teams · {lockedCount} ready</span>
          <button className="secondary" onClick={() => { end({ classId: cls.classId }); setCls(null); }}>End Class</button>
        </div>
      </header>

      <div className="teamGrid">
        {teams.map((t) => (
          <section key={t.teamId} className={`teamPanel ${t.locked ? "locked" : ""}`}>
            <h3>{t.name} {t.locked ? "🔒" : ""}</h3>
            <div className="lineupCards">
              {t.members.map((m, i) => {
                const c = cardFor(m.characterId);
                return (
                  <article key={i} className={`lineupCard ${m.role === "glitch" ? "glitchPick" : "breakerPick"}`}>
                    {c ? <img src={c.img} alt="" /> : <div className="lineupCard__blank" />}
                    <div>
                      <strong>{m.handle}</strong>
                      <span>{c ? c.name : "picking…"}{m.role === "glitch" ? " · Glitch" : ""}</span>
                    </div>
                  </article>
                );
              })}
              {t.members.length === 0 && <p className="small">empty</p>}
            </div>
          </section>
        ))}
        {teams.length === 0 && <p className="small waiting">Waiting for teams to join…</p>}
      </div>
    </div>
  );
}
