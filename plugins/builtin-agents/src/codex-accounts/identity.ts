/** Presentation only: never change the account/credential identity owned by the Host. */
export function maskCodexAccountIdentity(value: string): string {
  return value.replace(/([\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+)@([\p{L}\p{N}.-]+)/gu, (_email, local: string, domain: string) => {
    const localPrefix = [...local].length > 1 ? [...local][0] : "";
    const labels = domain.split(".");
    const maskedDomain = labels.map((label, index) => index === labels.length - 1 && labels.length > 1
      ? label : `${[...label].length > 1 ? [...label][0] : ""}***`).join(".");
    return `${localPrefix}***@${maskedDomain}`;
  });
}
