// INHERITFI: license parameters for the License page of the documentation.
// - Interface: they are read from the LICENSE.txt of this repository at build time (if the file changes, the page changes with it).
// - Contracts: the LICENSE.txt of v1-core is not in this repository; its parameters are written here
//   (same text as the LICENSE.txt of v1-core: the two only differ in Licensed Work and in the two ENS names).
//   The site test requires it.
import interfaceLicense from "../../LICENSE.txt?raw";

export interface LicenseParams {
  readonly first: string;
  readonly licensor: string;
  readonly work: string;
  readonly grant: string;
  readonly date: string;
  readonly dateEns: string;
  readonly change: string;
}

function one(re: RegExp, text: string, what: string): string {
  const m = re.exec(text);
  if (m?.[1] === undefined) throw new Error(`LICENSE.txt: ${what} not found`);
  return m[1];
}

/** Parameters of a BUSL 1.1 text in the INHERITFI format. Throws if any is missing. */
export function parseLicense(text: string): LicenseParams {
  return {
    first: text.split("\n")[0] ?? "",
    licensor: one(/^Licensor:\s+(.+)$/m, text, "Licensor"),
    work: one(/^Licensed Work:\s+(.+)$/m, text, "Licensed Work"),
    grant: one(/^Additional Use Grant: Any uses listed and defined at (\S+)$/m, text, "Additional Use Grant"),
    date: one(/^Change Date:\s+The earlier of (\d{4}-\d{2}-\d{2}) or a date specified at \S+$/m, text, "Change Date"),
    dateEns: one(/^Change Date:\s+The earlier of \d{4}-\d{2}-\d{2} or a date specified at (\S+)$/m, text, "Change Date ENS name"),
    change: one(/^Change License:\s+(.+)$/m, text, "Change License"),
  };
}

export const INTERFACE_LICENSE: LicenseParams = parseLicense(interfaceLicense);

export const CORE_LICENSE: LicenseParams = {
  first: "Business Source License 1.1",
  licensor: "INHERITFI ( https://inheritfi.com / inheritfi.eth )",
  work: "INHERITFI V1 Core",
  grant: "v1-core-license-grants.inheritfi.eth",
  date: "2030-11-10",
  dateEns: "v1-core-license-date.inheritfi.eth",
  change: "GNU General Public License v3.0 or later",
};
