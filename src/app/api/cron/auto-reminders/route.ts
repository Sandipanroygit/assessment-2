import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const normalizeGradeKey = (value?: string | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/grade/gi, "")
    .replace(/[^a-z0-9]+/g, "");

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const now = new Date();
    
    // --- 24 Hour Window (Drone & STEAM-H) ---
    const t24Min = new Date(now.getTime() + 23.5 * 60 * 60 * 1000).toISOString();
    const t24Max = new Date(now.getTime() + 24.5 * 60 * 60 * 1000).toISOString();

    // --- 15 Min Window (Simulations) ---
    // Using a 10-min grace range to ensure hit-rate with 10-min cron frequency
    const t15Min = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const t15Max = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const students = (listData.users ?? [])
      .filter((u) => {
        const role = ((u.user_metadata?.role as string | undefined)?.toLowerCase() ?? "");
        return role === "student" || role === "customer";
      })
      .map((u) => ({
        id: u.id,
        gradeKey: normalizeGradeKey((u.user_metadata?.grade as string | undefined) ?? null),
      }));

    const notificationsToInsert: Array<{
      user_id: string;
      title: string;
      message: string;
      status: string;
      module_id?: string | null;
      subject?: string | null;
    }> = [];

    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabaseAdmin
      .from("notifications")
      .select("user_id, title")
      .gte("created_at", oneDayAgo)
      .like("title", "Auto-Reminder:%");

    const alreadyReminded = new Set(
      (recentNotifications || []).map(n => `${n.user_id}::${n.title}`)
    );

    const addNotification = (userId: string, titleStr: string, message: string, moduleId: string | null = null, subject: string | null = null) => {
      const fullTitle = `Auto-Reminder: ${titleStr}`;
      const key = `${userId}::${fullTitle}`;
      if (!alreadyReminded.has(key)) {
        notificationsToInsert.push({
          user_id: userId,
          title: fullTitle,
          message,
          status: "unread",
          module_id: moduleId,
          subject,
        });
        alreadyReminded.add(key);
      }
    };

    // --- 1. STEAM-H Tasks (24 Hr Reminder) ---
    const { data: steamhAssignments } = await supabaseAdmin
      .from("steamh_assignments")
      .select("id, student_id, title, subject, due_at, submitted_at")
      .gte("due_at", t24Min)
      .lte("due_at", t24Max)
      .is("submitted_at", null);

    if (steamhAssignments) {
      for (const task of steamhAssignments) {
        addNotification(
          task.student_id,
          task.title,
          `Your STEAM-H project "${task.title}" is due in 24 hours. Please submit it soon.`,
          null,
          task.subject
        );
      }
    }

    // --- 2. Drone Activities (24 Hr Reminder) ---
    const { data: droneModules } = await supabaseAdmin
      .from("curriculum_modules")
      .select("id, title, grade, subject, due_at")
      .eq("published", true)
      .gte("due_at", t24Min)
      .lte("due_at", t24Max);

    if (droneModules && droneModules.length > 0) {
      const moduleIds = droneModules.map(m => m.id);
      const { data: submissions } = await supabaseAdmin
        .from("activity_submissions")
        .select("user_id, module_id, report_status")
        .in("module_id", moduleIds);

      for (const mod of droneModules) {
        const modGradeKey = normalizeGradeKey(mod.grade);
        const targetStudents = students.filter(s => !modGradeKey || s.gradeKey === modGradeKey);

        for (const student of targetStudents) {
          const hasSubmitted = (submissions || []).some(
            sub => sub.user_id === student.id && sub.module_id === mod.id && 
              ["submitted", "completed", "report ready"].includes((sub.report_status || "").toLowerCase())
          );

          if (!hasSubmitted) {
            addNotification(
              student.id,
              mod.title,
              `Your Drone Activity "${mod.title}" is due in 24 hours. Please complete it soon.`,
              mod.id,
              mod.subject
            );
          }
        }
      }
    }

    // --- 3. Simulations (15 Min Reminder) ---
    const { data: simAssignments } = await supabaseAdmin
      .from("simulation_assignments")
      .select("id, simulation_title, target_grade_key, target_grade, subject, due_at")
      .gte("due_at", t15Min)
      .lte("due_at", t15Max);

    if (simAssignments && simAssignments.length > 0) {
      const assignmentIds = simAssignments.map(a => a.id);
      const { data: simProgress } = await supabaseAdmin
        .from("simulation_assignment_progress")
        .select("assignment_id, student_id, status, assessment_submitted_at")
        .in("assignment_id", assignmentIds);

      for (const assignment of simAssignments) {
        const gradeKey = normalizeGradeKey(assignment.target_grade_key || assignment.target_grade);
        const targetStudents = students.filter(s => !gradeKey || s.gradeKey === gradeKey);

        for (const student of targetStudents) {
          const progress = (simProgress || []).find(
            p => p.assignment_id === assignment.id && p.student_id === student.id
          );
          const isCompleted = !!progress?.assessment_submitted_at || progress?.status?.toLowerCase() === "completed";

          if (!isCompleted) {
            addNotification(
              student.id,
              assignment.simulation_title,
              `Urgent: Your Simulation "${assignment.simulation_title}" is due in 15 minutes! Please complete it now.`,
              null,
              assignment.subject
            );
          }
        }
      }
    }

    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("notifications")
        .insert(notificationsToInsert);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true, remindersSent: notificationsToInsert.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Auto-reminder error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
