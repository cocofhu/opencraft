import { loadSkills, formatSkillsForPrompt } from '@earendil-works/pi-coding-agent';
/** Native Pi discovery: user/project roots stay owned by the native loader. */
export function piSkills(cwd: string, agentDirectory: string) {
  const official = process.env.OPENCRAFT_OFFICIAL_SKILLS_ROOT;
  return loadSkills({cwd,agentDir:agentDirectory,includeDefaults:true,skillPaths:official?[official]:[]});
}
export function piSkillsPrompt(cwd: string, agentDirectory: string) {
  return formatSkillsForPrompt(piSkills(cwd,agentDirectory).skills,'indirect');
}
