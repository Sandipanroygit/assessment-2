-- Seed sample STEAM-H showcase projects (with full feature fields)
-- Run this only after `supabase/steamh_projects_patch.sql`.

insert into public.steamh_projects (
  id,
  student_id,
  student_name,
  school_name,
  grade,
  subject,
  title,
  summary,
  description,
  challenge,
  solution,
  tools_used,
  tags,
  image_urls,
  video_urls,
  attachment_urls,
  external_links,
  published,
  created_at,
  updated_at
)
values
(
  '5d0f14a2-1f8d-4d31-8fdf-1ec9f0010001',
  null,
  'Ananya Sharma',
  'Greenfield Public School',
  '9',
  'Science + Technology',
  'Smart Water Quality Monitoring Buoy',
  'An IoT buoy that captures pH and impurity readings, then sends live water-quality alerts to a school dashboard.',
  'A floating prototype that reads water quality indicators, compares safe thresholds, and publishes trend charts for students to analyze seasonal patterns.',
  'Sensor readings were unstable in wave-heavy environments and noisy during outdoor testing.',
  'Added sample averaging, waterproof casing, and calibration checks before each reading cycle.',
  array['Arduino Nano 33 IoT','TDS Sensor','Fusion 360','Python','Google Sheets API'],
  array['iot','environment','sustainability','data-visualization'],
  '[
    "https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1508873699372-7ae9f91adbf8?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1400&q=80"
  ]'::jsonb,
  '[
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "https://www.youtube.com/watch?v=jNQXAC9IVRw"
  ]'::jsonb,
  '[
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.africau.edu/images/default/sample.pdf"
  ]'::jsonb,
  '[
    {"label":"Prototype Code","url":"https://github.com/openai/openai-quickstart-node"},
    {"label":"Live Dashboard","url":"https://observablehq.com/"}
  ]'::jsonb,
  false,
  now() - interval '30 days',
  now() - interval '30 days'
),
(
  '5d0f14a2-1f8d-4d31-8fdf-1ec9f0010002',
  null,
  'Rohan Iyer',
  'Springfield High',
  '10',
  'Engineering + Health',
  'Robotic Hand Therapy Assistant',
  'A low-cost wearable glove that tracks finger motion and guides hand-therapy repetitions for recovery sessions.',
  'The system combines flex sensors and servo-assisted prompts to demonstrate rehabilitation engineering and data-driven progress tracking in a classroom.',
  'Gesture classification was unreliable for users with different hand sizes.',
  'Added per-user calibration and threshold tuning before each exercise session.',
  array['ESP32','Flex Sensors','Servo Motors','TensorFlow Lite','Onshape'],
  array['biomedical','robotics','accessibility','health-tech'],
  '[
    "https://images.unsplash.com/photo-1581090700227-1e37b190418e?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=80"
  ]'::jsonb,
  '[
    "https://www.youtube.com/watch?v=bTqVqk7FSmY",
    "https://www.youtube.com/watch?v=6x5U8f9Y8Ew"
  ]'::jsonb,
  '[
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.africau.edu/images/default/sample.pdf"
  ]'::jsonb,
  '[
    {"label":"CAD Preview","url":"https://www.onshape.com/"},
    {"label":"Evaluation Sheet","url":"https://docs.google.com/"}
  ]'::jsonb,
  false,
  now() - interval '21 days',
  now() - interval '21 days'
),
(
  '5d0f14a2-1f8d-4d31-8fdf-1ec9f0010003',
  null,
  'Meera Nair',
  'Delhi Public School',
  '8',
  'Mathematics + Arts',
  'Classroom Energy Digital Twin',
  'An interactive digital twin showing classroom energy use, with math-driven optimization and student-friendly visual storytelling.',
  'Students modeled classroom energy loads, tested schedule alternatives, and built visual summaries to explain savings potential clearly to peers and teachers.',
  'Initial visuals were too technical for middle-school students.',
  'Redesigned with icon-led cards, contrast-safe colors, and one-glance summaries.',
  array['Scratch','Figma','Excel','Micro:bit','JavaScript'],
  array['digital-twin','energy','math-modeling','design-thinking'],
  '[]'::jsonb,
  '[
    "https://www.youtube.com/watch?v=oUFJJNQGwhk",
    "https://www.youtube.com/watch?v=ysz5S6PUM-U"
  ]'::jsonb,
  '[
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.africau.edu/images/default/sample.pdf"
  ]'::jsonb,
  '[
    {"label":"Design File","url":"https://www.figma.com/"},
    {"label":"Data Workbook","url":"https://www.office.com/"}
  ]'::jsonb,
  false,
  now() - interval '12 days',
  now() - interval '12 days'
)
on conflict (id) do update set
  student_name = excluded.student_name,
  school_name = excluded.school_name,
  grade = excluded.grade,
  subject = excluded.subject,
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  challenge = excluded.challenge,
  solution = excluded.solution,
  tools_used = excluded.tools_used,
  tags = excluded.tags,
  image_urls = excluded.image_urls,
  video_urls = excluded.video_urls,
  attachment_urls = excluded.attachment_urls,
  external_links = excluded.external_links,
  published = excluded.published,
  updated_at = now();

notify pgrst, 'reload schema';
