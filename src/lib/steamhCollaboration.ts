export const COLLAB_PROFILE_SLUG = "nikhil-11";
export const COLLAB_PROFILE_PATH = `/student-profile/${COLLAB_PROFILE_SLUG}`;

export const COLLAB_PUBLISHER = {
  name: "Nikhil",
  grade: "11",
  school: "STEAM-H Showcase Publisher",
  focus: "Applied STEAM projects and interdisciplinary problem solving",
  collaborationEmail: "nikhil.grade11@aerohawx.org",
} as const;

export const buildProjectCollabPath = (projectId: string) =>
  `/steamh-projects/${encodeURIComponent(projectId)}/collaborate`;

export const buildCollabLoginPath = (targetPath = COLLAB_PROFILE_PATH) =>
  `/login?next=${encodeURIComponent(targetPath)}&reason=collab`;
