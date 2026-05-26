import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function TeacherClass() {
  const open = useMutation(api.classes.openClass);
  const end = useMutation(api.classes.endClass);
  const [cls, setCls] = useState(null);
  const dash = useQuery(api.classes.classDashboard, cls ? { classId: cls.classId } : "skip");

  if (!cls) {
    return <button className="startButton" onClick={async () => setCls(await open({}))}>Start Class</button>;
  }

  return (
    <div className="dashboard">
      <h1>Join code: <b className="classCode">{cls.code}</b></h1>
      <p className="small">Students go to this site, tap “I’m a student,” and enter the code.</p>
      <div className="teamGrid">
        {(dash?.teams ?? []).map((t) => (
          <div key={t.teamId} className={`teamCard ${t.locked ? "locked" : ""}`}>
            <h3>{t.name} {t.locked ? "🔒" : ""}</h3>
            <ul>
              {t.members.map((m, i) => (
                <li key={i}>{m.handle} — {m.characterId ?? "picking…"}{m.role === "glitch" ? " (Glitch)" : ""}</li>
              ))}
            </ul>
          </div>
        ))}
        {(dash?.teams ?? []).length === 0 && <p className="small">Waiting for teams…</p>}
      </div>
      <button className="secondary" onClick={() => { end({ classId: cls.classId }); setCls(null); }}>End Class</button>
    </div>
  );
}
