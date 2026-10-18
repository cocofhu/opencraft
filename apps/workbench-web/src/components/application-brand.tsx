import { DEFAULT_APPLICATION_BRANDING, type ApplicationBrandingContribution } from "@opencraft/extension-contract";
import { serverUrl } from "../runtime/server-context";
export function ApplicationBrand({ branding = DEFAULT_APPLICATION_BRANDING }: { readonly branding?: ApplicationBrandingContribution }) {
  return <span className="application-brand" data-mobile-mark={branding.showMarkOnMobile === false ? "hidden" : undefined} role="img" aria-label={branding.name}>
    {branding.markUrl && <img aria-hidden="true" alt="" width={26} height={26} src={serverUrl(branding.markUrl)} className="application-brand__mark" />}
    <span className="application-brand__wordmark">{branding.name}</span>
  </span>;
}
