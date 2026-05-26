import { useState } from "react";
import { TeacherAuth } from "./TeacherAuth.jsx";
import { TeacherClass } from "./TeacherClass.jsx";
import { KidJoin } from "./KidJoin.jsx";

export function LiveApp({ onBack }) {
  const [who, setWho] = useState(null); // "teacher" | "student"
  return (
    <div className="liveShell">
      <button className="secondary backBtn" onClick={onBack}>← Back</button>
      {!who && (
        <div className="liveRolePick">
          <h1>The Last Variable — Classroom</h1>
          <button className="startButton" onClick={() => setWho("teacher")}>I’m the teacher</button>
          <button className="startButton" onClick={() => setWho("student")}>I’m a student</button>
        </div>
      )}
      {who === "teacher" && <TeacherAuth><TeacherClass /></TeacherAuth>}
      {who === "student" && <KidJoin />}
    </div>
  );
}
