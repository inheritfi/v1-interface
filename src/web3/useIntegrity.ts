import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { evaluateIntegrity, observeDeployment, type Finding } from "./integrity";
import { deploymentInfo } from "./network";

export interface IntegrityReport {
  problems: Finding[];
  warnings: Finding[];
}

/** Integrity check at startup: once per manifest; it is repeated only if the user asks for it. */
export function useIntegrity() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["inheritfi", "integrity", deploymentInfo.manifestSha256],
    queryFn: async (): Promise<IntegrityReport> => {
      if (client === undefined) {
        throw new Error("No client for the configured chain");
      }
      const findings = evaluateIntegrity(deploymentInfo, await observeDeployment(client, deploymentInfo));
      return {
        problems: findings.filter((f) => f.severity === "problem"),
        warnings: findings.filter((f) => f.severity === "warning"),
      };
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
