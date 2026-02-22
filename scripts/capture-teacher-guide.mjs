import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEV_BASE_URL = process.env.TEACHER_GUIDE_BASE_URL || "http://127.0.0.1:3000";
const RAW_DIR = path.join(process.cwd(), "docs", "teacher-guide", "snips", "raw");
const EDGE_PROFILE_DIR = path.join(process.cwd(), "docs", "teacher-guide", ".edge-profile");

const LOGIN_EMAIL = process.env.TEACHER_DEMO_EMAIL || "teacher.demo@aerohawx.local";
const LOGIN_PASSWORD = process.env.TEACHER_DEMO_PASSWORD || "TeacherDemo@123";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // keep waiting
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const onOpen = () => resolve();
      const onError = (event) => reject(new Error(`WebSocket error: ${event?.message ?? "unknown"}`));
      this.ws.addEventListener("open", onOpen, { once: true });
      this.ws.addEventListener("error", onError, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (!data.id) return;
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.error) {
        pending.reject(new Error(data.error.message ?? `CDP error on ${pending.method}`));
        return;
      }
      pending.resolve(data.result);
    });
  }

  async send(method, params = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result?.result?.value;
  }

  async waitForExpression(expression, timeoutMs = 20000, label = expression) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const matched = await this.evaluate(`(() => Boolean(${expression}))()`);
        if (matched) return true;
      } catch {
        // retry
      }
      await sleep(250);
    }
    throw new Error(`Timed out waiting for expression: ${label}`);
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitForExpression(`document.readyState === "complete"`, 20000, `load ${url}`);
  }

  async fill(selector, value) {
    const selectorJson = JSON.stringify(selector);
    const valueJson = JSON.stringify(value);
    const ok = await this.evaluate(`(() => {
      const input = document.querySelector(${selectorJson});
      if (!input) return false;
      input.focus();
      input.value = ${valueJson};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    if (!ok) {
      throw new Error(`Could not fill selector ${selector}`);
    }
  }

  async clickByText(text, tags = "button,a") {
    const textJson = JSON.stringify(text.toLowerCase());
    const tagsJson = JSON.stringify(tags);
    const ok = await this.evaluate(`(() => {
      const textValue = ${textJson};
      const selectors = ${tagsJson}.split(",");
      const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector.trim())));
      const visible = candidates.filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      });
      const matches = visible.filter((el) => (el.textContent || "").trim().toLowerCase().includes(textValue));
      const target = matches[matches.length - 1];
      if (!target) return false;
      target.click();
      return true;
    })()`);
    if (!ok) {
      throw new Error(`Could not click element with text "${text}"`);
    }
  }

  async clickByAriaLabel(label) {
    const selector = `[aria-label="${label.replaceAll('"', '\\"')}"]`;
    const selectorJson = JSON.stringify(selector);
    const ok = await this.evaluate(`(() => {
      const button = document.querySelector(${selectorJson});
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!ok) {
      throw new Error(`Could not click element with aria-label "${label}"`);
    }
  }

  async screenshot(filePath) {
    const result = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(filePath, Buffer.from(result.data, "base64"));
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function getWsUrl() {
  const endpoint = "http://127.0.0.1:9222/json/list";
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const body = await response.json();
        if (Array.isArray(body)) {
          const target = body.find((item) => item?.type === "page" && item?.webSocketDebuggerUrl);
          if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
        }
      }
    } catch {
      // keep trying
    }
    await sleep(200);
  }
  throw new Error("Could not connect to Edge remote debugging endpoint.");
}

const buildStorageKey = (supabaseUrl) => {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
};

async function createTeacherSession() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase public env vars for session creation.");
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });
  if (error || !data?.session) {
    throw new Error(`Unable to sign in teacher demo account: ${error?.message ?? "no session returned"}`);
  }
  return {
    session: data.session,
    storageKey: buildStorageKey(SUPABASE_URL),
  };
}

async function main() {
  if (!existsSync(EDGE_PATH)) {
    throw new Error(`Edge not found at ${EDGE_PATH}`);
  }

  await rm(RAW_DIR, { recursive: true, force: true });
  await mkdir(RAW_DIR, { recursive: true });
  await rm(EDGE_PROFILE_DIR, { recursive: true, force: true });
  await mkdir(EDGE_PROFILE_DIR, { recursive: true });

  const { session, storageKey } = await createTeacherSession();
  const sessionBlob = JSON.stringify(session);

  await waitForHttp(`${DEV_BASE_URL}/login`, 90000);

  const edgeProc = spawn(
    EDGE_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9222",
      "--user-data-dir=" + EDGE_PROFILE_DIR,
      "--window-size=1440,920",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp = null;
  try {
    const wsUrl = await getWsUrl();
    cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 920,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.navigate(`${DEV_BASE_URL}/login`);
    const insertedSession = await cdp.evaluate(`(() => {
      localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(sessionBlob)});
      return Boolean(localStorage.getItem(${JSON.stringify(storageKey)}));
    })()`);
    if (!insertedSession) {
      throw new Error("Unable to inject teacher session into localStorage.");
    }

    await cdp.navigate(`${DEV_BASE_URL}/customer`);
    await cdp.waitForExpression('window.location.pathname.startsWith("/customer")', 20000, "open customer");
    await cdp.waitForExpression(
      'document.querySelectorAll("#curriculum a[href^=\\"/customer/activity/\\"]").length > 0',
      35000,
      "teacher modules loaded",
    );
    await sleep(900);
    await cdp.screenshot(path.join(RAW_DIR, "01_teacher_dashboard.png"));

    await cdp.clickByAriaLabel("Open teacher menu");
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("p")).some((el) => (el.textContent || "").includes("Teacher actions"))',
      10000,
      "teacher menu open",
    );
    await sleep(600);
    await cdp.screenshot(path.join(RAW_DIR, "02_teacher_menu.png"));

    await cdp.clickByText("Raise a Request", "button");
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("h3")).some((el) => (el.textContent || "").includes("Request content"))',
      10000,
      "request modal open",
    );
    await sleep(600);
    await cdp.screenshot(path.join(RAW_DIR, "03_request_modal.png"));

    await cdp.navigate(`${DEV_BASE_URL}/customer`);
    await cdp.waitForExpression(
      'document.querySelectorAll("#curriculum a[href^=\\"/customer/activity/\\"]").length > 0',
      30000,
      "modules loaded before notifications",
    );
    await cdp.waitForExpression('document.querySelector("[aria-label=\\"Notifications\\"]") !== null', 15000, "bell");
    await cdp.clickByAriaLabel("Notifications");
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("span")).some((el) => (el.textContent || "").trim() === "Notifications")',
      10000,
      "notifications panel open",
    );
    await sleep(600);
    await cdp.screenshot(path.join(RAW_DIR, "04_notifications.png"));

    await cdp.clickByText("Student Queries", "button");
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("h3")).some((el) => (el.textContent || "").includes("Student queries"))',
      10000,
      "teacher inbox open",
    );
    await sleep(600);
    await cdp.screenshot(path.join(RAW_DIR, "05_teacher_inbox.png"));

    await cdp.navigate(`${DEV_BASE_URL}/teacher/progress`);
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("h1")).some((el) => (el.textContent || "").includes("Student progress"))',
      15000,
      "progress page",
    );
    await sleep(800);
    await cdp.screenshot(path.join(RAW_DIR, "06_progress.png"));

    await cdp.navigate(`${DEV_BASE_URL}/teacher/students`);
    await cdp.waitForExpression(
      'Array.from(document.querySelectorAll("h1")).some((el) => (el.textContent || "").includes("Registered students"))',
      15000,
      "students page",
    );
    await sleep(800);
    await cdp.screenshot(path.join(RAW_DIR, "07_students.png"));

    await cdp.navigate(`${DEV_BASE_URL}/customer`);
    await cdp.waitForExpression(
      'document.querySelectorAll("#curriculum a[href^=\\"/customer/activity/\\"]").length > 0',
      30000,
      "modules loaded before publish view",
    );
    await cdp.waitForExpression('document.getElementById("curriculum") !== null', 15000, "curriculum section");
    await cdp.evaluate(`(() => {
      const section = document.getElementById("curriculum");
      if (!section) return false;
      section.scrollIntoView({ behavior: "instant", block: "start" });
      return true;
    })()`);
    await sleep(700);
    await cdp.screenshot(path.join(RAW_DIR, "08_publish_controls.png"));

    const activityPath = await cdp.evaluate(`(() => {
      const link = document.querySelector('#curriculum a[href^="/customer/activity/"]');
      return link ? link.getAttribute("href") : null;
    })()`);
    if (typeof activityPath === "string" && activityPath.startsWith("/customer/activity/")) {
      await cdp.navigate(`${DEV_BASE_URL}${activityPath}`);
      await cdp.waitForExpression('document.body.innerText.toLowerCase().includes("activity")', 15000, "activity page");
      await sleep(700);
      await cdp.screenshot(path.join(RAW_DIR, "09_activity_detail.png"));
    }

    console.log("Teacher guide screenshots captured.");
  } finally {
    if (cdp) cdp.close();
    if (!edgeProc.killed) {
      edgeProc.kill("SIGTERM");
    }
    await rm(EDGE_PROFILE_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
