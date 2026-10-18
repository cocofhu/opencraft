/** Trusted, synchronous build composition. Never inferred from product identity. */
export interface WorkbenchPresentationOptions {
  readonly iconStyle?: "standard" | "classic";
  readonly defaultThemeId?: string;
  readonly hiddenBuiltinThemeIds?: readonly string[];
}

export interface WorkbenchPresentation {
  readonly iconStyle: "standard" | "classic";
  readonly defaultThemeId?: string;
  readonly hiddenBuiltinThemeIds: readonly string[];
}

export function resolveWorkbenchPresentation(options: WorkbenchPresentationOptions = {}): WorkbenchPresentation {
  if (options === null || typeof options !== "object" || Array.isArray(options)
    || (options.defaultThemeId !== undefined && typeof options.defaultThemeId !== "string")
    || (options.hiddenBuiltinThemeIds !== undefined && (!Array.isArray(options.hiddenBuiltinThemeIds)
      || options.hiddenBuiltinThemeIds.some(id => typeof id !== "string")))) {
    throw new TypeError("Invalid Workbench presentation options");
  }
  if (options.iconStyle !== undefined && options.iconStyle !== "standard" && options.iconStyle !== "classic") {
    throw new TypeError("Unknown Workbench icon style");
  }
  const defaultThemeId = options.defaultThemeId?.trim();
  const hiddenBuiltinThemeIds = [...(options.hiddenBuiltinThemeIds ?? [])];
  if ((options.defaultThemeId !== undefined && !defaultThemeId)
    || hiddenBuiltinThemeIds.some(id => !id.trim() || id !== id.trim())
    || (defaultThemeId !== undefined && hiddenBuiltinThemeIds.includes(defaultThemeId))) {
    throw new TypeError("Invalid Workbench theme policy");
  }
  return Object.freeze({
    iconStyle: options.iconStyle ?? "standard",
    ...(defaultThemeId === undefined ? {} : { defaultThemeId }),
    hiddenBuiltinThemeIds: Object.freeze([...new Set(hiddenBuiltinThemeIds)]),
  });
}

/** Build-generated JSON, read once before the first appearance snapshot. */
export function parseWorkbenchPresentation(serialized?: string): WorkbenchPresentation {
  return resolveWorkbenchPresentation(serialized === undefined ? {} : JSON.parse(serialized));
}
