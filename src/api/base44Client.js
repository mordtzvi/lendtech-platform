export const base44ClientMode = "local-placeholder";

export function describeBase44Boundary() {
  return {
    mode: base44ClientMode,
    note: "This MVP keeps Base44-shaped schemas and a local data adapter. Swap this boundary for @base44/sdk once the Base44 CLI is available and the app is linked.",
    expectedSdkMethods: ["entities.Entity.create", "entities.Entity.list", "entities.Entity.update", "entities.Entity.filter", "auth.me", "functions.invoke"]
  };
}
