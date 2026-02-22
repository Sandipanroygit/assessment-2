import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.env.TEACHER_DEMO_EMAIL || "teacher.demo@aerohawx.local";
const password = process.env.TEACHER_DEMO_PASSWORD || "TeacherDemo@123";
const fullName = process.env.TEACHER_DEMO_NAME || "Teacher Demo";
const subject = process.env.TEACHER_DEMO_SUBJECT || "Physics";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars. Check .env.local.");
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey);

async function ensureTeacherDemo() {
  console.log(`Checking for teacher demo account ${email}...`);
  const emailNormalized = email.toLowerCase();
  const { data: usersData, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("Lookup failed:", listError.message);
    process.exit(1);
  }

  const existingUser = usersData?.users?.find((u) => (u.email ?? "").toLowerCase() === emailNormalized);
  let userId = existingUser?.id;

  if (!existingUser) {
    console.log("Teacher demo not found. Creating...");
    const { data: createData, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "teacher", subject },
    });
    if (createError || !createData?.user) {
      console.error("User creation failed:", createError?.message);
      process.exit(1);
    }
    userId = createData.user.id;
  } else {
    const { error: updateError } = await client.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: { full_name: fullName, role: "teacher", subject },
    });
    if (updateError) {
      console.warn("Unable to update existing teacher metadata:", updateError.message);
    }
  }

  if (!userId) {
    console.error("Unable to resolve teacher user id.");
    process.exit(1);
  }

  console.log("Upserting teacher profile row...");
  const { error: profileError } = await client.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role: "teacher",
      subject,
      grade: null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("Profile upsert failed:", profileError.message);
    process.exit(1);
  }

  console.log("Teacher demo ready.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Subject: ${subject}`);
}

ensureTeacherDemo();
