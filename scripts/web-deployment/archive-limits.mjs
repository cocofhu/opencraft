// Component browser runtimes are part of the self-contained server package.
// Keep bounded transport and extraction budgets shared by local and registry sources.
export const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024;
