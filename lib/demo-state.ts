/** The screens the open demo can be switched to with `?state=`. "default" is the normal first screen. */
export const demoStates = [
  { id: "default", label: "Start" },
  { id: "draft", label: "Draft" },
  { id: "template", label: "Template draft" },
  { id: "error", label: "Error" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "No conflict" },
] as const;
export type DemoState = (typeof demoStates)[number]["id"];

/** Anything that is not a known state is ignored, so a mistyped link shows the normal page. */
export const parseDemoState = (value: string | string[] | undefined): DemoState | undefined =>
  demoStates.find(state => state.id === value)?.id;
